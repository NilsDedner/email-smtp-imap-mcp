/**
 * Live test against real mailboxes (e.g. IONOS). Run with `npm run test:live`.
 *
 * Needs one mailbox (A). Mail is then sent to A itself and the forward goes to LIVE_EXTERNAL_TO,
 * an address you control. With a second mailbox (B) delivery is checked between A and B instead.
 *
 * Safety: every message the test creates carries a unique run id in its subject, all
 * folders it creates are named after that id, and cleanup only ever selects by that id.
 * Provider quirks that are not failures of this server are recorded as findings.
 */
import assert from 'node:assert/strict';
import path from 'node:path';
import test, { after, before } from 'node:test';

import dotenv from 'dotenv';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

dotenv.config({ path: path.resolve('.env.live'), quiet: true });

const e = process.env;

// Credentials can also arrive as a ready-made account (see with-keychain.sh), so no password has to be
// written to a file: LIVE_ACCOUNTS_JSON holds {smtp: {...}, imap: {...}} objects keyed by account name.
if (e.LIVE_ACCOUNTS_JSON && e.LIVE_ACCOUNT) {
  const chosen = JSON.parse(e.LIVE_ACCOUNTS_JSON)[e.LIVE_ACCOUNT];
  if (chosen) {
    Object.assign(e, {
      LIVE_SMTP_HOST: chosen.smtp.host,
      LIVE_SMTP_PORT: String(chosen.smtp.port ?? 587),
      LIVE_IMAP_HOST: chosen.imap.host,
      LIVE_IMAP_PORT: String(chosen.imap.port ?? 993),
      LIVE_A_USER: chosen.smtp.user,
      LIVE_A_PASS: chosen.smtp.password
    });
  }
}
const hasB = Boolean(e.LIVE_B_USER && e.LIVE_B_PASS);
const configured = ['LIVE_SMTP_HOST', 'LIVE_IMAP_HOST', 'LIVE_A_USER', 'LIVE_A_PASS'].every((key) => e[key]) && (hasB || e.LIVE_EXTERNAL_TO);
const skip = configured ? false : 'Fill .env.live (see .env.live.example) to run the live test';

// Where test mail is delivered and which account reads it
const RX = hasB ? 'b' : 'a';
const RECIPIENT = hasB ? e.LIVE_B_USER : e.LIVE_A_USER;
const FORWARD_TO = hasB ? e.LIVE_A_USER : e.LIVE_EXTERNAL_TO;

const RUN = `MCP-LIVE-${Date.now().toString(36)}`;
const FOLDER = RUN;
const findings = [];
let client;

const soft = (name, ok, detail = '') => findings.push(`${ok ? 'ok  ' : 'NOTE'} ${name}${detail ? ` (${detail})` : ''}`);

async function call(name, args = {}) {
  if (DELAY) await pause(DELAY);
  const result = await client.callTool({ name, arguments: args });
  return JSON.parse(result.content[0].text);
}

async function ok(name, args) {
  const result = await call(name, args);
  assert.equal(result.success, true, `${name} failed: ${result.error || JSON.stringify(result.errors)}`);
  return result;
}

async function waitFor(description, fn, timeoutMs = 120000) {
  const started = Date.now();
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() - started > timeoutMs) throw new Error(`Timed out waiting for ${description}`);
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}

const find = async (account, folder, subject) =>
  (await ok('emails_find', { account_name: account, folder, filters: { subject } })).emails;
const findExact = async (account, folder, subject) => (await find(account, folder, subject)).filter((m) => m.subject === subject);

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const DELAY = Number(e.LIVE_DELAY_MS ?? 250);

before(async () => {
  if (skip) return;
  const account = (user, pass, extra = {}) => ({
    smtp: { host: e.LIVE_SMTP_HOST, port: Number(e.LIVE_SMTP_PORT || 587), secure: e.LIVE_SMTP_PORT === '465', user, password: pass },
    imap: { host: e.LIVE_IMAP_HOST, port: Number(e.LIVE_IMAP_PORT || 993), secure: e.LIVE_IMAP_SECURE !== 'false', user, password: pass },
    save_to_sent: true,
    allow_permanent_delete: true,
    ...extra
  });
  client = new Client({ name: 'live-test', version: '1.0.0' });
  await client.connect(new StdioClientTransport({
    command: process.execPath,
    args: [path.resolve('build/index.js')],
    env: {
      PATH: process.env.PATH || '',
      ...(e.IMAP_DEBUG_LOG ? { IMAP_DEBUG_LOG: e.IMAP_DEBUG_LOG } : {}),
      DEFAULT_EMAIL_ACCOUNT: 'a',
      EMAIL_ACCOUNTS_JSON: JSON.stringify({
        a: account(e.LIVE_A_USER, e.LIVE_A_PASS),
        ...(hasB ? { b: account(e.LIVE_B_USER, e.LIVE_B_PASS) } : {})
      })
    }
  }));
});

after(async () => {
  if (skip || !client) return;
  // Remove everything carrying the run id, in every folder of both accounts
  for (const accountName of hasB ? ['a', 'b'] : ['a']) {
    try {
      const folders = (await call('folders_list', { account_name: accountName })).folders || [];
      // Test mail only ever lands in INBOX, the special folders and the test folders
      const places = folders.filter((f) => f.selectable !== false && (f.path === 'INBOX' || (f.special_use && f.special_use !== '\\Inbox') || f.path === FOLDER || f.path.startsWith(`${FOLDER}/`) || f.path.startsWith(`${FOLDER}.`)));
      for (const folder of places) {
        const selection = { account_name: accountName, folder: folder.path, filters: { subject: RUN } };
        const dry = await call('emails_modify', { ...selection, dry_run: true });
        if (dry.matched > 0) await call('emails_modify', { ...selection, delete: true, permanent: true, expected_count: dry.matched });
      }
      const mine = (f) => f.path === FOLDER || f.path.startsWith(`${FOLDER}/`) || f.path.startsWith(`${FOLDER}.`);
      for (const folder of folders.filter(mine).sort((x, y) => y.path.length - x.path.length)) {
        const result = await call('folder_delete', { account_name: accountName, name: folder.path });
        if (!result.success) console.error(`Could not delete test folder ${folder.path}: ${result.error}`);
      }
      const remaining = ((await call('folders_list', { account_name: accountName })).folders || []).filter(mine);
      for (const folder of remaining) findings.push(`LEFTOVER folder ${folder.path} (account ${accountName}, subscribed=${folder.subscribed}); delete it by hand`);
      if (remaining.length === 0) findings.push(`ok   test folders removed (account ${accountName})`);
    } catch (error) {
      console.error(`Cleanup for account ${accountName} failed: ${error.message}`);
    }
  }
  await client.close();
  console.log(`\nLive test run ${RUN}\n${findings.join('\n')}\n`);
});

test('folders: special-use detection, create, nest, rename', { skip }, async () => {
  const listed = await ok('folders_list');
  const special = Object.fromEntries(listed.folders.filter((f) => f.special_use).map((f) => [f.special_use, f.path]));
  soft('special-use folders reported', Object.keys(special).length >= 3, JSON.stringify(special));
  for (const use of ['\\Sent', '\\Drafts', '\\Trash']) assert.ok(special[use], `server does not flag ${use}`);
  soft('Junk folder flagged \\Junk', Boolean(special['\\Junk']), special['\\Junk'] || 'none; name fallback is used');
  const delimiter = listed.folders.find((f) => f.path === 'INBOX').delimiter;
  soft('hierarchy delimiter', true, JSON.stringify(delimiter));

  await ok('folder_create', { name: FOLDER });
  await ok('folder_create', { name: `${FOLDER}${delimiter}Sub` });
  await ok('folder_create', { name: `${FOLDER}${delimiter}Old` });
  const renamed = await ok('folder_rename', { name: `${FOLDER}${delimiter}Old`, new_name: `${FOLDER}${delimiter}New` });
  assert.equal(renamed.to, `${FOLDER}${delimiter}New`);
  const after = (await ok('folders_list')).folders.map((f) => f.path);
  assert.ok(after.includes(`${FOLDER}${delimiter}Sub`) && after.includes(`${FOLDER}${delimiter}New`));
  assert.ok(!after.includes(`${FOLDER}${delimiter}Old`));

  assert.equal((await call('folder_create', { name: FOLDER })).success, false, 'duplicate folder must fail');
  assert.equal((await call('folder_delete', { name: special['\\Trash'] })).success, false, 'Trash must be protected');
});

test('drafts: create, update, send, delivery to the second account', { skip }, async () => {
  const subject = `${RUN} draft`;
  const draft = await ok('draft_create', { to: [RECIPIENT], subject, body: 'first', body_type: 'plain' });
  soft('draft append reports a UID (UIDPLUS)', Boolean(draft.email_id), draft.email_id ? '' : 'found via Message-ID search instead');
  assert.ok(draft.email_id, 'draft must be addressable');

  const stored = await waitFor('draft in Drafts', async () => (await find('a', draft.folder, subject))[0]);
  assert.equal(stored.id, draft.email_id);

  const updated = await ok('draft_update', { email_id: draft.email_id, body: '<p>second</p>', body_type: 'html' });
  assert.equal((await find('a', draft.folder, subject)).length, 1, 'old draft copy must be gone');

  // Wait for the delivery with emails_wait instead of polling; note how long the provider takes
  const waitStarted = Date.now();
  const waiting = call('emails_wait', { account_name: RX, timeout_seconds: 100, filters: { subject } });
  await pause(1500);
  const sent = await ok('draft_send', { email_id: updated.email_id });
  assert.equal(sent.draft_removed, true);
  assert.equal(sent.sent_copy?.saved, true, `sent copy not saved: ${JSON.stringify(sent.sent_copy)}`);
  soft('Sent folder used', true, sent.sent_copy.folder);

  const arrival = await waiting;
  assert.equal(arrival.success, true, arrival.error);
  soft('emails_wait returned on delivery', arrival.timed_out === false, `${Math.round((Date.now() - waitStarted) / 1000)} s from start of waiting`);
  const delivered = await waitFor('delivery', async () => (await findExact(RX, 'INBOX', subject))[0]);
  assert.ok(delivered);
  const withBody = await ok('emails_find', { account_name: RX, filters: { subject }, include_content: true });
  assert.match(withBody.emails[0].body, /second/);
  assert.equal((await findExact('a', draft.folder, subject)).length, 0, 'sent draft must be gone');
  assert.equal((await findExact('a', sent.sent_copy.folder, subject)).length, 1);
});

test('send with attachment, list and download it, reply and forward flag the original', { skip }, async () => {
  const subject = `${RUN} attach`;
  const content = Buffer.from([0, 1, 2, 250, 255, 10, 13, 65]);
  await ok('email_send', {
    to: [RECIPIENT],
    subject,
    body: 'with file',
    body_type: 'plain',
    attachments: [
      { filename: 'data.bin', content: content.toString('base64'), content_type: 'application/octet-stream' },
      { filename: 'Übersicht März.txt', content: Buffer.from('umlaut').toString('base64'), content_type: 'text/plain' }
    ]
  });
  const mail = await waitFor('attachment mail', async () => (await findExact(RX, 'INBOX', subject))[0]);
  assert.deepEqual(mail.attachment_list.map((a) => a.filename).sort(), ['data.bin', 'Übersicht März.txt']);

  const file = await ok('attachment_get', { account_name: RX, email_id: mail.id, filename: 'data.bin' });
  assert.deepEqual(Buffer.from(file.content, 'base64'), content);
  const umlaut = await ok('attachment_get', { account_name: RX, email_id: mail.id, filename: 'Übersicht März.txt' });
  assert.equal(Buffer.from(umlaut.content, 'base64').toString(), 'umlaut');

  const reply = await ok('email_respond', { account_name: RX, email_id: mail.id, body: 'got it', body_type: 'plain' });
  soft('\\Answered set on original', reply.original_flagged === true);
  const replyAt = hasB ? 'a' : RX;
  assert.ok(await waitFor('reply', async () => (await find(replyAt, 'INBOX', `Re: ${subject}`))[0]));

  const forward = await ok('email_respond', { account_name: RX, email_id: mail.id, response_type: 'forward', to: [FORWARD_TO], body: 'fyi', body_type: 'plain' });
  soft('$Forwarded keyword stored by the server', forward.original_flagged === true);
  if (hasB) {
    await waitFor('forward at A', async () => (await find('a', 'INBOX', `Fwd: ${subject}`))[0]);
  } else {
    soft('forward sent to the external address', true, `${FORWARD_TO}: subject "Fwd: ${subject}", check it arrived`);
  }

  const answered = await ok('emails_find', { account_name: RX, filters: { subject, is_answered: true } });
  soft('answered flag visible in search', answered.emails.some((m) => m.subject === subject));
  const forwarded = await ok('emails_find', { account_name: RX, filters: { subject, is_forwarded: true } });
  soft('forwarded keyword visible in search', forwarded.emails.some((m) => m.subject === subject));
});

test('organizing: flags, move, copy, spam, paging, bulk and delete', { skip }, async () => {
  const sub = `${FOLDER}${(await ok('folders_list')).folders.find((f) => f.path === 'INBOX').delimiter}Sub`;
  // Cheap seed mails: drafts created straight into the test folder
  const ids = [];
  for (let i = 1; i <= 5; i++) {
    ids.push((await ok('draft_create', { subject: `${RUN} seed ${i}`, body: `seed ${i}`, body_type: 'plain', folder: FOLDER })).email_id);
  }
  assert.equal((await ok('emails_find', { folder: FOLDER, filters: { subject: RUN } })).total_found, 5);

  // Paging
  const page1 = await ok('emails_find', { folder: FOLDER, filters: { subject: RUN }, limit: 2 });
  const page2 = await ok('emails_find', { folder: FOLDER, filters: { subject: RUN }, limit: 2, offset: 2 });
  const page3 = await ok('emails_find', { folder: FOLDER, filters: { subject: RUN }, limit: 2, offset: 4 });
  assert.deepEqual([page1.count, page2.count, page3.count, page3.has_more], [2, 2, 1, false]);
  assert.equal(new Set([...page1.emails, ...page2.emails, ...page3.emails].map((m) => m.id)).size, 5);

  // Flags
  await ok('emails_modify', { folder: FOLDER, email_ids: [ids[0]], flag: true, mark_unread: true });
  const flagged = (await ok('emails_find', { folder: FOLDER, filters: { is_flagged: true, subject: RUN } })).emails;
  assert.deepEqual(flagged.map((m) => m.id), [ids[0]]);
  await ok('emails_modify', { folder: FOLDER, email_ids: [ids[0]], unflag: true });

  // Move and copy
  await ok('emails_modify', { folder: FOLDER, email_ids: [ids[1]], move_to_folder: sub });
  assert.equal((await find('a', sub, `${RUN} seed 2`)).length, 1);
  await ok('emails_modify', { folder: FOLDER, email_ids: [ids[2]], copy_to_folder: sub });
  assert.equal((await find('a', sub, `${RUN} seed 3`)).length, 1);
  assert.equal((await find('a', FOLDER, `${RUN} seed 3`)).length, 1, 'copy keeps the original');
  const missing = await call('emails_modify', { folder: FOLDER, email_ids: [ids[2]], move_to_folder: `${RUN}-nope` });
  assert.equal(missing.success, false, 'move to a missing folder must be reported');

  // Spam round trip
  const spam = await call('emails_modify', { folder: FOLDER, email_ids: [ids[3]], mark_spam: true });
  soft('mark_spam finds the Junk folder', spam.success === true, spam.success ? `moved to ${spam.moved_to}` : spam.error);
  if (spam.success) {
    const inJunk = (await find('a', spam.moved_to, `${RUN} seed 4`))[0];
    assert.ok(inJunk, 'spam message must be in the Junk folder');
    soft('$Junk keyword stored', true);
    const back = await ok('emails_modify', { folder: spam.moved_to, email_ids: [inJunk.id], mark_not_spam: true });
    assert.equal(back.moved_to, 'INBOX');
    assert.equal((await find('a', 'INBOX', `${RUN} seed 4`)).length, 1);
  }

  // Bulk with dry run
  const selection = { folder: FOLDER, filters: { subject: RUN } };
  const dry = await ok('emails_modify', { ...selection, dry_run: true });
  assert.ok(dry.matched >= 1);
  const refused = await call('emails_modify', { ...selection, mark_read: true });
  assert.equal(refused.success, false);
  await ok('emails_modify', { ...selection, mark_read: true, expected_count: dry.matched });
  assert.equal((await ok('emails_find', { folder: FOLDER, filters: { subject: RUN, is_unread: true } })).total_found, 0);

  // Delete to Trash, then permanently
  const trash = (await ok('folders_list')).folders.find((f) => f.special_use === '\\Trash').path;
  const soft1 = await ok('emails_modify', { folder: FOLDER, email_ids: [ids[4]], delete: true });
  assert.equal(soft1.deleted_to, trash);
  const trashed = (await find('a', trash, `${RUN} seed 5`))[0];
  assert.ok(trashed, 'deleted message must be in Trash');
  await ok('emails_modify', { folder: trash, email_ids: [trashed.id], delete: true, permanent: true });
  assert.equal((await find('a', trash, `${RUN} seed 5`)).length, 0);
});

test('read-only protection holds on the live account', { skip }, async () => {
  // A second client with a read-only copy of account a
  const readOnly = new Client({ name: 'live-readonly', version: '1.0.0' });
  await readOnly.connect(new StdioClientTransport({
    command: process.execPath,
    args: [path.resolve('build/index.js')],
    env: {
      PATH: process.env.PATH || '',
      ...(e.IMAP_DEBUG_LOG ? { IMAP_DEBUG_LOG: e.IMAP_DEBUG_LOG } : {}),
      EMAIL_ACCOUNTS_JSON: JSON.stringify({
        ro: {
          smtp: { host: e.LIVE_SMTP_HOST, port: Number(e.LIVE_SMTP_PORT || 587), user: e.LIVE_A_USER, password: e.LIVE_A_PASS },
          imap: { host: e.LIVE_IMAP_HOST, port: Number(e.LIVE_IMAP_PORT || 993), secure: e.LIVE_IMAP_SECURE !== 'false', user: e.LIVE_A_USER, password: e.LIVE_A_PASS },
          read_only: true
        }
      })
    }
  }));
  try {
    const read = JSON.parse((await readOnly.callTool({ name: 'folders_list', arguments: {} })).content[0].text);
    assert.equal(read.success, true);
    const write = JSON.parse((await readOnly.callTool({ name: 'folder_create', arguments: { name: `${RUN}-ro` } })).content[0].text);
    assert.equal(write.success, false);
    assert.match(write.error, /read-only/);
  } finally {
    await readOnly.close();
  }
});
