import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { allowedOrigins, loadRegistrationEnvironment, registrationEnvPath } from '../environment.js';

test('el .env privado se resuelve junto al servidor desde la raíz o server/', () => {
  const moduleUrl = new URL('../environment.js', import.meta.url).href;
  const server = fileURLToPath(new URL('..', import.meta.url));
  const code = `import { registrationEnvPath } from ${JSON.stringify(moduleUrl)}; console.log(registrationEnvPath);`;
  for (const cwd of [server, path.dirname(server)]) {
    const result = execFileSync(process.execPath, ['--input-type=module', '-e', code], { cwd, encoding: 'utf8' }).trim();
    assert.equal(result, registrationEnvPath);
    assert.equal(result, path.join(server, '.env'));
  }
});
test('carga orígenes locales y conserva las variables ya configuradas en Render', t => {
  const directory = mkdtempSync(path.join(tmpdir(), 'milpaweb-env-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const envPath = path.join(directory, '.env');
  writeFileSync(envPath, 'WEBSITE_ALLOWED_ORIGINS=http://localhost:4173\nPRIVATE_TEST_VALUE=local\n');
  const local = loadRegistrationEnvironment({ env: {}, envPath });
  assert.deepEqual(allowedOrigins(local), ['http://localhost:4173']);
  const deployed = loadRegistrationEnvironment({ env: { WEBSITE_ALLOWED_ORIGINS: 'https://milpagrow-web.onrender.com', PRIVATE_TEST_VALUE: 'render' }, envPath });
  assert.deepEqual(allowedOrigins(deployed), ['https://milpagrow-web.onrender.com']);
  assert.equal(deployed.PRIVATE_TEST_VALUE, 'render');
});
test('admite barras finales y normaliza el host sin ampliar los dominios permitidos', () => {
  assert.deepEqual(allowedOrigins({ WEBSITE_ALLOWED_ORIGINS: ' https://MilpaGrow-Web.onrender.com/,https://milpagrow-web.onrender.com,http://localhost:4173/ ' }), ['https://milpagrow-web.onrender.com', 'http://localhost:4173']);
});
test('detecta configuración ausente o inválida con instrucciones claras', () => {
  assert.throws(() => allowedOrigins({}), /Falta WEBSITE_ALLOWED_ORIGINS.*server\/\.env/);
  for (const value of ['*', 'null', 'file:///tmp', 'https://web.example/acceso.html', 'https://user:pass@web.example', 'https://web.example?token=secret', 'https://web.example#fragment']) {
    assert.throws(() => allowedOrigins({ WEBSITE_ALLOWED_ORIGINS: value }), /WEBSITE_ALLOWED_ORIGINS debe contener/);
  }
});
