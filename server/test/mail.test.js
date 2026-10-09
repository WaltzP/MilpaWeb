import test from 'node:test';
import assert from 'node:assert/strict';
import { registrationMailer } from '../mail.js';

const env = { BREVO_API_KEY: 'private-test-key', BREVO_FROM_EMAIL: 'accounts@example.test' };
test('Node envía a Brevo un correo con el código y exige confirmación del proveedor', async () => {
  let sent;
  const send = registrationMailer(env, async (url, options) => { sent = { url, options, body: JSON.parse(options.body) }; return new Response(JSON.stringify({ messageId: 'accepted' }), { status: 201 }); });
  await send('ana@example.test', '000123'); assert.equal(sent.options.headers['api-key'], env.BREVO_API_KEY);
  assert.deepEqual(sent.body.to, [{ email: 'ana@example.test' }]); assert.ok(sent.body.textContent.includes('000123')); assert.ok(sent.body.htmlContent.includes('000123'));
  assert.ok(!JSON.stringify(sent.body).includes(env.BREVO_API_KEY));
  for (const response of [new Response('{}'), new Response('{"messageId":""}'), new Response('{}', { status: 429 })]) {
    await assert.rejects(registrationMailer(env, async () => response)('ana@example.test', '123456'), error => error.code === 'MAIL_SEND');
  }
  await assert.rejects(registrationMailer(env, async () => { throw new Error(); })('ana@example.test', '123456'), error => error.code === 'MAIL_NETWORK');
});
test('la configuración de correo incompleta falla antes de crear cuentas', () => {
  assert.throws(() => registrationMailer({}), /BREVO/);
});
