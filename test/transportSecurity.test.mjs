import assert from 'node:assert/strict';
import test from 'node:test';
import net from 'node:net';
import tls from 'node:tls';
import { readFileSync } from 'node:fs';
import { SMTPServer } from 'smtp-server';
import nodemailer from 'nodemailer';
import { sendEmail } from '../build/smtpService.js';
import { modifyEmails } from '../build/imapService.js';

const account = {
  smtp_host: '127.0.0.1', smtp_port: 0, smtp_secure: false,
  smtp_user: 'test@example.test', smtp_pass: 'test-password',
  imap_host: '127.0.0.1', imap_port: 0, imap_secure: false,
  imap_user: 'test@example.test', imap_pass: 'test-password'
};
const message = { to: ['recipient@example.test'], subject: 'TLS test', body: 'test' };

async function listen(server, t) {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return server.address().port;
}

test('SMTP and IMAP refuse a server without STARTTLS before sending credentials', async t => {
  const commands = [];
  const sockets = new Set();
  const server = net.createServer(socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.write('220 test SMTP\r\n');
    socket.on('data', data => {
      const line = data.toString();
      commands.push(line);
      if (/^EHLO/i.test(line)) socket.write('250-test\r\n250 AUTH PLAIN LOGIN\r\n');
      else if (/^STARTTLS/i.test(line)) socket.write('502 TLS not available\r\n');
    });
  });
  const port = await listen(server, t);
  t.after(() => { for (const socket of sockets) socket.destroy(); });
  await assert.rejects(sendEmail({ ...account, smtp_port: port }, message), /STARTTLS|TLS/);
  assert.ok(!commands.some(line => /^AUTH/i.test(line)), 'no SMTP credentials on plaintext socket');

  const imapCommands = [];
  const imapServer = net.createServer(socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.write('* OK test IMAP\r\n');
    socket.on('data', data => {
      const line = data.toString();
      imapCommands.push(line);
      const tag = line.split(' ')[0];
      if (/CAPABILITY/i.test(line)) socket.write(`* CAPABILITY IMAP4rev1 AUTH=PLAIN\r\n${tag} OK capabilities\r\n`);
      else socket.write(`${tag} NO unavailable\r\n`);
    });
  });
  const imapPort = await listen(imapServer, t);
  await assert.rejects(modifyEmails({ ...account, imap_port: imapPort }, [], {}), /TLS/);
  assert.ok(!imapCommands.some(line => /AUTHENTICATE|LOGIN/i.test(line)), 'no IMAP credentials on plaintext socket');
});

test('SMTP rejects an untrusted STARTTLS certificate before authentication', async t => {
  let authenticated = false;
  const server = new SMTPServer({
    logger: false,
    onAuth(auth, session, callback) {
      authenticated = true;
      callback(null, { user: auth.username });
    }
  });
  server.on('error', () => {}); // Expected peer TLS rejection.
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const port = server.server.address().port;
  await assert.rejects(sendEmail({ ...account, smtp_port: port }, message), /certificate|self.signed|hostname/i);
  assert.equal(authenticated, false);
});

test('IMAP rejects an untrusted implicit TLS certificate and gives secure recovery advice', async t => {
  // This process does not trust the identity; only the positive MCP subprocess does.
  const server = tls.createServer({
    key: readFileSync(new URL('./fixtures/localhost-key.pem', import.meta.url)),
    cert: readFileSync(new URL('./fixtures/localhost-cert.pem', import.meta.url))
  }, socket => socket.end());
  server.on('tlsClientError', () => {});
  const port = await listen(server, t);
  await assert.rejects(modifyEmails({ ...account, imap_port: port, imap_secure: true }, [], {}), error => {
    assert.match(error.message, /TLS/);
    assert.doesNotMatch(error.message, /Try setting imap_secure/);
    return true;
  });
});

test('SMTP retains implicit TLS and STARTTLS settings with TLS 1.2 and certificate verification', async t => {
  const original = nodemailer.createTransport;
  const captured = [];
  nodemailer.createTransport = options => {
    captured.push(options);
    return { async sendMail() { return { messageId: '<test@example.test>' }; } };
  };
  t.after(() => { nodemailer.createTransport = original; });
  await sendEmail(account, message);
  await sendEmail({ ...account, smtp_secure: true, smtp_port: 465 }, message);
  assert.deepEqual(captured.map(options => options.secure), [false, true]);
  for (const options of captured) {
    assert.equal(options.requireTLS, true);
    assert.deepEqual(options.tls, { minVersion: 'TLSv1.2', rejectUnauthorized: true });
  }
});
