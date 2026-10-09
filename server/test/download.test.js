import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './fixture.js';

async function verified(f, admin = false) {
  const user = await f.auth.createUser({ email: 'verified@example.test', emailVerified: true });
  f.tokens.set('verified', { uid: user.uid, email: user.email, email_login_verified: true, email_login_address: user.email });
  if (admin) f.users.get(user.uid).customClaims.milpagrowAdmin = true;
  return user;
}
const metadata = { sizeBytes: 1234, version: '1.2.0' };
const invalidGrant = error => error.code === 'DOWNLOAD_GRANT_INVALID';

test('contraseña sola, correo cambiado y cuenta desactivada no autorizan descargas', async () => {
  const f = fixture(), user = await verified(f);
  f.tokens.set('password', { uid: user.uid, email: user.email, email_verified: true });
  await assert.rejects(f.service.grant('password'), error => error.code === 'MFA_REQUIRED');
  await assert.rejects(f.service.grant('fake'), error => error.code === 'INVALID_TOKEN');
  f.users.get(user.uid).disabled = true;
  await assert.rejects(f.service.grant('verified'), error => error.code === 'MFA_REQUIRED');
  assert.ok(![...f.documents.keys()].some(key => key.startsWith('websiteDownloadGrants/')));
});
test('permiso de un solo uso: no guarda tokens; sólo una descarga concurrente se registra', async () => {
  const f = fixture(), user = await verified(f);
  const { grant } = await f.service.grant('verified');
  assert.match(grant, /^[A-Za-z0-9_-]{43}$/); assert.ok(!JSON.stringify([...f.documents]).includes(grant));
  assert.equal(f.registered(user.uid).downloadCount, 0);
  const results = await Promise.allSettled([f.service.beginDownload(grant, metadata), f.service.beginDownload(grant, metadata)]);
  const accepted = results.filter(result => result.status === 'fulfilled'); assert.equal(accepted.length, 1);
  assert.equal(f.registered(user.uid).downloadCount, 1);
  const event = accepted[0].value;
  await f.service.finishDownload(event, true); await f.service.finishDownload(event, true);
  assert.equal(f.registered(user.uid).completedDownloadCount, 1);
  assert.equal(f.documents.get(event.path).status, 'completed');
  assert.equal(f.documents.get(event.path).version, '1.2.0');
  await assert.rejects(f.service.checkDownload(grant), invalidGrant);
});
test('el permiso caduca y comprueba revocación, correo y cuenta actuales al descargar', async () => {
  for (const change of [{ disabled: true }, { email: 'changed@example.test' }, { emailVerified: false }, { tokensValidAfterTime: 'revoked' }]) {
    const f = fixture(), user = await verified(f), { grant } = await f.service.grant('verified');
    Object.assign(f.users.get(user.uid), change);
    await assert.rejects(f.service.beginDownload(grant, metadata), invalidGrant);
    assert.equal(f.registered(user.uid).downloadCount, 0);
  }
  const f = fixture(); await verified(f); const { grant } = await f.service.grant('verified'); f.advance(120000);
  await assert.rejects(f.makeService().checkDownload(grant), invalidGrant);
  await assert.rejects(f.service.checkDownload('invented'), invalidGrant);
});
test('el límite por cuenta persiste y una transferencia fallida no cuenta como entregada', async () => {
  const f = fixture(), user = await verified(f);
  const { grant } = await f.service.grant('verified'), event = await f.service.beginDownload(grant, metadata);
  await f.service.finishDownload(event, false);
  assert.equal(f.registered(user.uid).downloadCount, 1); assert.equal(f.registered(user.uid).completedDownloadCount, 0);
  assert.equal(f.documents.get(event.path).status, 'failed');
  for (let i = 1; i < 10; i++) await f.service.grant('verified');
  await assert.rejects(f.makeService().grant('verified'), error => error.code === 'REGISTRATION_LIMIT');
  await f.service.session('verified'); assert.equal(f.registered(user.uid).downloadCount, 1);
});
test('sólo un administrador vigente con verificación puede consultar usuarios paginados', async () => {
  const f = fixture(), user = await verified(f);
  await assert.rejects(f.service.registeredUsers('verified'), error => error.code === 'ADMIN_REQUIRED');
  f.users.get(user.uid).customClaims.milpagrowAdmin = true;
  for (let i = 0; i < 52; i++) {
    f.advance(1);
    const account = await f.auth.createUser({ email: `user${i}@example.test`, emailVerified: true });
    f.tokens.set('account', { uid: account.uid, email: account.email, email_login_verified: true, email_login_address: account.email });
    await f.service.session('account');
  }
  const page = await f.service.registeredUsers('verified'); assert.equal(page.items.length, 50); assert.ok(page.nextCursor);
  const next = await f.service.registeredUsers('verified', page.nextCursor); assert.equal(next.items.length, 2); assert.equal(next.nextCursor, null);
  assert.ok(!page.items.some(item => next.items.some(other => other.uid === item.uid)));
  assert.ok(!JSON.stringify(page).includes('password'));
  await assert.rejects(f.service.registeredUsers('verified', '../fake'), error => error.code === 'INVALID_CURSOR');
  f.users.get(user.uid).customClaims = {};
  await assert.rejects(f.service.registeredUsers('verified'), error => error.code === 'ADMIN_REQUIRED');
});
