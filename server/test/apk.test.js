import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { apkSource } from '../apk.js';

test('la APK privada se transmite desde archivo, sin un enlace público de reserva', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'milpaweb-apk-')); t.after(() => rm(directory, { recursive: true }));
  const file = join(directory, 'MilpaGrow.apk'); await writeFile(file, 'private-apk-fixture');
  const apk = await apkSource({ WEBSITE_APK_PATH: file, WEBSITE_APK_VERSION: '1.2.0' })();
  const chunks = []; for await (const chunk of apk.stream) chunks.push(chunk);
  assert.equal(Buffer.concat(chunks).toString(), 'private-apk-fixture'); assert.equal(apk.sizeBytes, 19); assert.equal(apk.version, '1.2.0'); apk.close();
  for (const env of [{}, { WEBSITE_APK_PATH: join(directory, 'missing.apk') }]) await assert.rejects(apkSource(env)(), error => error.code === 'APK_UNAVAILABLE');
});
test('el origen HTTPS usa la credencial sólo en el servidor y rechaza páginas de error', async () => {
  const env = { WEBSITE_APK_URL: 'https://private.example/MilpaGrow.apk', WEBSITE_APK_AUTH_TOKEN: 'private-secret' };
  const apk = await apkSource(env, async (url, options) => {
    assert.equal(url, env.WEBSITE_APK_URL); assert.equal(options.headers.Authorization, 'Bearer private-secret');
    return new Response('apk', { headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': '3' } });
  })();
  assert.equal(apk.sizeBytes, 3); assert.equal(await new Response(apk.stream).text(), 'apk'); apk.close();
  for (const response of [new Response('error', { status: 403 }), new Response('<html>login</html>', { headers: { 'Content-Type': 'text/html' } })]) {
    await assert.rejects(apkSource(env, async () => response)(), error => error.code === 'APK_UNAVAILABLE');
  }
  assert.throws(() => apkSource({ WEBSITE_APK_URL: 'http://private.example/app.apk' }));
  assert.throws(() => apkSource({ ...env, WEBSITE_APK_PATH: '/private/app.apk' }));
});
