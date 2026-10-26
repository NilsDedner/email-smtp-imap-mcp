import assert from 'node:assert/strict';
import path from 'node:path';
import test, { after, before, beforeEach } from 'node:test';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

import { dockerAvailable, startMailEnv } from './helpers/mailEnv.mjs';

const skip = dockerAvailable() ? false : 'Docker is not available';

let env;
let client;

async function call(name, args = {}) {
  const result = await client.callTool({ name, arguments: args });
  return { ...JSON.parse(result.content[0].text), isError: Boolean(result.isError) };
}

before(async () => {
  if (skip) return;
  env = await startMailEnv();
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.resolve('build/index.js')],
    env: { PATH: process.env.PATH || '', ...env.serverEnv() }
  });
  client = new Client({ name: 'integration-test', version: '1.0.0' });
  await client.connect(transport);
});

after(async () => {
  if (skip) return;
  await client?.close();
  await env?.stop();
});

beforeEach(async () => {
  if (skip) return;
  await env.reset();
});

test('send delivers to the recipient and stores a sent copy', { skip }, async () => {
  const sent = await call('email_send', { to: ['bob@example.test'], subject: 'Hello Bob', body: 'Hi', body_type: 'plain' });
  assert.equal(sent.success, true);
  assert.equal(sent.sent_copy.saved, true);
  assert.equal(sent.sent_copy.folder, 'Sent');

  const inbox = await env.messages('bob');
  assert.deepEqual(inbox.map((m) => m.subject), ['Hello Bob']);
  const sentBox = await env.messages('alice', 'Sent');
  assert.deepEqual(sentBox.map((m) => m.subject), ['Hello Bob']);
  assert.ok(sentBox[0].flags.has('\\Seen'));
});

test('emails_find filters in INBOX and in other folders', { skip }, async () => {
  await env.seed('alice', { subject: 'Invoice 1', from: 'billing@example.test' });
  await env.seed('alice', { subject: 'Lunch', from: 'friend@example.test', flags: ['\\Seen'] });
  await env.seed('alice', { folder: 'Trash', subject: 'Old news' });

  const unread = await call('emails_find', { filters: { is_unread: true } });
  assert.deepEqual(unread.emails.map((e) => e.subject), ['Invoice 1']);

  const bySender = await call('emails_find', { filters: { from: 'friend@example.test' }, include_content: true });
  assert.equal(bySender.count, 1);
  assert.match(bySender.emails[0].body, /seed body/);

  const trash = await call('emails_find', { folder: 'Trash' });
  assert.deepEqual(trash.emails.map((e) => e.subject), ['Old news']);

  const missing = await call('emails_find', { folder: 'DoesNotExist' });
  assert.equal(missing.success, false);
});

test('emails_modify changes flags and moves messages', { skip }, async () => {
  const uid = await env.seed('alice', { subject: 'Organize me' });

  assert.equal((await call('emails_modify', { email_ids: [String(uid)], mark_read: true, flag: true })).success, true);
  let [message] = await env.messages('alice');
  assert.ok(message.flags.has('\\Seen') && message.flags.has('\\Flagged'));

  assert.equal((await call('emails_modify', { email_ids: [String(uid)], mark_unread: true, unflag: true })).success, true);
  [message] = await env.messages('alice');
  assert.ok(!message.flags.has('\\Seen') && !message.flags.has('\\Flagged'));

  assert.equal((await call('folder_create', { name: 'Archive' })).success, true);
  assert.equal((await call('emails_modify', { email_ids: [String(uid)], move_to_folder: 'Archive' })).success, true);
  assert.deepEqual(await env.messages('alice'), []);
  assert.deepEqual((await env.messages('alice', 'Archive')).map((m) => m.subject), ['Organize me']);

  const [moved] = await env.messages('alice', 'Archive');
  const back = await call('emails_modify', { folder: 'Archive', email_ids: [String(moved.uid)], move_to_folder: 'INBOX' });
  assert.equal(back.success, true);
  assert.deepEqual((await env.messages('alice')).map((m) => m.subject), ['Organize me']);
});

test('emails_modify delete moves to Trash, permanent removes for good', { skip }, async () => {
  const first = await env.seed('alice', { subject: 'Delete me' });
  const second = await env.seed('alice', { subject: 'Wipe me' });

  const soft = await call('emails_modify', { email_ids: [String(first)], delete: true });
  assert.equal(soft.success, true);
  assert.equal(soft.deleted_to, 'Trash');
  assert.deepEqual((await env.messages('alice', 'Trash')).map((m) => m.subject), ['Delete me']);

  const hard = await call('emails_modify', { email_ids: [String(second)], delete: true, permanent: true });
  assert.equal(hard.success, true);
  assert.deepEqual(await env.messages('alice'), []);
  assert.deepEqual((await env.messages('alice', 'Trash')).map((m) => m.subject), ['Delete me']);

  const [trashed] = await env.messages('alice', 'Trash');
  const purge = await call('emails_modify', { folder: 'Trash', email_ids: [String(trashed.uid)], delete: true, permanent: true });
  assert.equal(purge.success, true);
  assert.deepEqual(await env.messages('alice', 'Trash'), []);
});

test('draft_create stores a flagged draft without sending it', { skip }, async () => {
  const draft = await call('draft_create', {
    to: ['bob@example.test'],
    subject: 'Work in progress',
    body: '<p>Not done yet</p>',
    attachments: [{ filename: 'note.txt', content: Buffer.from('attached').toString('base64'), content_type: 'text/plain' }]
  });
  assert.equal(draft.success, true);
  assert.equal(draft.folder, 'Drafts');
  assert.ok(draft.email_id);

  const [stored] = await env.messages('alice', 'Drafts');
  assert.equal(stored.subject, 'Work in progress');
  assert.ok(stored.flags.has('\\Draft'));
  assert.equal(stored.parsed.attachments[0].filename, 'note.txt');
  assert.deepEqual(await env.messages('bob'), []);

  const noRecipient = await call('draft_create', { subject: 'Later', body: 'x', body_type: 'plain' });
  assert.equal(noRecipient.success, true);
  assert.equal((await env.messages('alice', 'Drafts')).length, 2);
});

test('folder_create and folder_delete manage folders and protect special ones', { skip }, async () => {
  const created = await call('folder_create', { name: 'Projects/2026' });
  assert.equal(created.success, true);
  assert.equal(created.folder, 'Projects/2026');

  const listed = await call('folders_list', { include_counts: true });
  const paths = listed.folders.map((f) => f.path);
  assert.ok(paths.includes('Projects/2026') && paths.includes('INBOX') && paths.includes('Sent'));

  assert.equal((await call('folder_create', { name: 'Projects/2026' })).success, false);

  for (const name of ['INBOX', 'Sent', 'Drafts', 'Trash']) {
    const refused = await call('folder_delete', { name });
    assert.equal(refused.success, false, `${name} must be protected`);
  }
  assert.equal((await call('folder_delete', { name: 'Nope' })).success, false);

  assert.equal((await call('folder_delete', { name: 'Projects/2026' })).success, true);
  const after = await call('folders_list');
  assert.ok(!after.folders.some((f) => f.path === 'Projects/2026'));
});

test('email_respond replies with threading headers and forwards', { skip }, async () => {
  const uid = await env.seed('alice', { subject: 'Question', from: 'bob@example.test', body: 'Can you help?' });

  const reply = await call('email_respond', { email_id: String(uid), body: 'Sure', response_type: 'reply', body_type: 'plain' });
  assert.equal(reply.success, true);
  const [received] = await env.messages('bob');
  assert.equal(received.subject, 'Re: Question');
  assert.ok(received.parsed.inReplyTo);
  assert.equal(reply.original_flagged, true);
  assert.ok((await env.messages('alice'))[0].flags.has('\\Answered'));

  const forward = await call('email_respond', {
    email_id: String(uid),
    body: 'FYI',
    response_type: 'forward',
    to: ['bob@example.test'],
    body_type: 'plain'
  });
  assert.equal(forward.success, true);
  const subjects = (await env.messages('bob')).map((m) => m.subject).sort();
  assert.deepEqual(subjects, ['Fwd: Question', 'Re: Question']);
});

test('read_only accounts can read but not change anything', { skip }, async () => {
  const uid = await env.seed('bob', { subject: 'Look but do not touch' });
  const readOnly = { account_name: 'bob' };

  const found = await call('emails_find', { ...readOnly, include_content: true });
  assert.equal(found.success, true);
  assert.equal(found.emails[0].subject, 'Look but do not touch');
  assert.ok(found.emails[0].is_unread);
  const [stillUnread] = await env.messages('bob');
  assert.ok(!stillUnread.flags.has('\\Seen'), 'reading must not mark mail as seen');
  assert.equal((await call('folders_list', readOnly)).success, true);

  const blocked = [
    ['email_send', { to: ['alice@example.test'], subject: 's', body: 'b' }],
    ['email_respond', { email_id: String(uid), body: 'b' }],
    ['draft_create', { subject: 's', body: 'b' }],
    ['emails_modify', { email_ids: [String(uid)], mark_read: true }],
    ['emails_modify', { email_ids: [String(uid)], delete: true }],
    ['folder_create', { name: 'Nope' }],
    ['folder_delete', { name: 'Nope' }]
  ];
  for (const [name, args] of blocked) {
    const result = await call(name, { ...readOnly, ...args });
    assert.equal(result.success, false, `${name} must be blocked`);
    assert.match(result.error, /read-only/);
  }
  assert.equal((await env.messages('bob')).length, 1);
  assert.equal((await env.messages('alice')).length, 0);
});

test('permanent deletion and folder deletion are locked by default', { skip }, async () => {
  const uid = await env.seed('alice', { subject: 'Keep me' });
  await call('folder_create', { name: 'Keep' });
  const account = { account_name: 'alice_safe' };

  const permanent = await call('emails_modify', { ...account, email_ids: [String(uid)], delete: true, permanent: true });
  assert.equal(permanent.success, false);
  assert.match(permanent.error, /ALLOW_PERMANENT_DELETE/);
  const folder = await call('folder_delete', { ...account, name: 'Keep' });
  assert.equal(folder.success, false);
  assert.match(folder.error, /ALLOW_PERMANENT_DELETE/);
  assert.equal((await env.messages('alice')).length, 1);

  const soft = await call('emails_modify', { ...account, email_ids: [String(uid)], delete: true });
  assert.equal(soft.success, true);
  assert.equal((await env.messages('alice', 'Trash')).length, 1);
});

test('allow_delete=false blocks every kind of delete but not moves', { skip }, async () => {
  const uid = await env.seed('alice', { subject: 'Stay' });
  await call('folder_create', { name: 'Elsewhere' });
  const account = { account_name: 'alice_nodelete' };

  const soft = await call('emails_modify', { ...account, email_ids: [String(uid)], delete: true });
  assert.equal(soft.success, false);
  assert.match(soft.error, /ALLOW_DELETE/);
  assert.equal((await env.messages('alice')).length, 1);

  const moved = await call('emails_modify', { ...account, email_ids: [String(uid)], move_to_folder: 'Elsewhere' });
  assert.equal(moved.success, true);
});

test('accounts_list reports the safety switches', { skip }, async () => {
  const listed = await call('accounts_list');
  const byName = Object.fromEntries(listed.accounts.map((a) => [a.name, a]));
  assert.deepEqual(
    [byName.alice.read_only, byName.alice.allow_delete, byName.alice.allow_permanent_delete],
    [false, true, true]
  );
  assert.equal(byName.bob.read_only, true);
  assert.equal(byName.alice_safe.allow_permanent_delete, false);
  assert.equal(byName.alice_nodelete.allow_delete, false);
});

test('email_respond works from any folder and flags the original', { skip }, async () => {
  const uid = await env.seed('alice', { folder: 'Trash', subject: 'Filed away', from: 'bob@example.test' });

  const reply = await call('email_respond', { folder: 'Trash', email_id: String(uid), body: 'Thanks', body_type: 'plain' });
  assert.equal(reply.success, true);
  assert.equal(reply.original_flagged, true);
  assert.deepEqual((await env.messages('bob')).map((m) => m.subject), ['Re: Filed away']);
  let [original] = await env.messages('alice', 'Trash');
  assert.ok(original.flags.has('\\Answered'));
  assert.ok(!original.flags.has('$Forwarded'));

  const forward = await call('email_respond', {
    folder: 'Trash',
    email_id: String(uid),
    body: 'FYI',
    response_type: 'forward',
    to: ['bob@example.test'],
    body_type: 'plain'
  });
  assert.equal(forward.success, true);
  assert.equal(forward.original_flagged, true);
  [original] = await env.messages('alice', 'Trash');
  assert.ok(original.flags.has('\\Answered') && original.flags.has('$Forwarded'));

  const wrongFolder = await call('email_respond', { email_id: String(uid), body: 'x' });
  assert.equal(wrongFolder.success, false);
});
