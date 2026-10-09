import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../app.js';
import { fixture } from './fixture.js';
import { Readable } from 'node:stream';
import { AuthError } from '../errors.js';

test('rutas HTTP, CORS, errores y tokens: registro y sesión', async t => {
  const f = fixture(), app = createApp(f.service, { origins: ['https://web.example.test'] });
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const options = { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://web.example.test' }, body: JSON.stringify(f.values) };
  const denied = await fetch(`${base}/api/registration/start`, { ...options, headers: { ...options.headers, Origin: 'https://other.example.test' } });
  assert.equal(denied.status, 403); assert.equal(f.users.size, 0);
  const malformed = await fetch(`${base}/api/registration/start`, { ...options, body: '{' }); assert.equal(malformed.status, 400);
  const preflight = await fetch(`${base}/api/registration/confirm`, { method: 'OPTIONS', headers: { Origin: options.headers.Origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' } });
  assert.equal(preflight.status, 204); assert.equal(preflight.headers.get('access-control-allow-origin'), options.headers.Origin);
  const result = await fetch(`${base}/api/registration/start`, options); assert.equal(result.status, 200);
  assert.equal(result.headers.get('cache-control'), 'no-store'); const started = (await result.json()).data;
  const confirmed = await fetch(`${base}/api/registration/confirm`, { ...options, body: JSON.stringify({ challenge: started.challenge, code: f.codes[0].code }) });
  assert.equal(confirmed.status, 200); assert.ok((await confirmed.json()).data.customToken);
  const missing = await fetch(`${base}/api/registration/session`); assert.equal(missing.status, 401);
  const invalid = await fetch(`${base}/api/registration/session`, { headers: { Authorization: 'Bearer fake' } }); assert.equal(invalid.status, 401);
  const oversized = await fetch(`${base}/api/registration/start`, { ...options, body: JSON.stringify({ extra: 'a'.repeat(9000) }) }); assert.equal(oversized.status, 413);
  assert.equal((await fetch(`${base}/not-found`)).status, 404);
});

test('HTTP entrega la APK sólo con permiso vigente, no redirige y registra la transferencia', async t => {
  const f = fixture(), user = await f.auth.createUser({ email: 'download@example.test', emailVerified: true });
  f.tokens.set('verified', { uid: user.uid, email: user.email, email_login_verified: true, email_login_address: user.email });
  let opened = 0, unavailable = false;
  const app = createApp(f.service, { origins: ['https://web.example.test'], openApk: async () => {
    opened++; if (unavailable) throw new AuthError(503, 'APK_UNAVAILABLE', 'No disponible');
    const stream = Readable.from(Buffer.from('apk-fixture'));
    return { stream, sizeBytes: 11, version: '1.2.0', close: () => stream.destroy() };
  } });
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/registration`;
  assert.equal((await fetch(`${base}/download-grant`, { method: 'POST' })).status, 401);
  assert.equal((await fetch(`${base}/download/fake`)).status, 403); assert.equal(opened, 0);
  const nativeError = await fetch(`${base}/download/fake`, { headers: { Accept: 'text/html' } });
  assert.equal(nativeError.status, 403); assert.match(nativeError.headers.get('content-type'), /text\/html/);
  assert.ok((await nativeError.text()).includes('https://web.example.test/acceso.html'));
  const response = await fetch(`${base}/download-grant`, { method: 'POST', headers: { Authorization: 'Bearer verified' } });
  const { grant } = (await response.json()).data;
  assert.equal((await fetch(`${base}/download/${grant}`, { method: 'HEAD' })).status, 405); assert.equal(opened, 0);
  unavailable = true; assert.equal((await fetch(`${base}/download/${grant}`)).status, 503); assert.equal(f.registered(user.uid).downloadCount, 0);
  unavailable = false;
  const file = await fetch(`${base}/download/${grant}`);
  assert.equal(file.status, 200); assert.equal(file.headers.get('location'), null);
  assert.equal(file.headers.get('content-disposition'), 'attachment; filename="MilpaGrow.apk"');
  assert.equal(file.headers.get('cache-control'), 'no-store'); assert.equal(await file.text(), 'apk-fixture');
  // La auditoría se confirma después de que el servidor termina de transmitir.
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.registered(user.uid).downloadCount, 1); assert.equal(f.registered(user.uid).completedDownloadCount, 1);
  assert.equal((await fetch(`${base}/download/${grant}`)).status, 403);
  assert.equal((await fetch(`${base}/users`, { headers: { Authorization: 'Bearer verified' } })).status, 403);
});
