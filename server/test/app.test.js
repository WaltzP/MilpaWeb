import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../app.js';
import { fixture } from './fixture.js';

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
