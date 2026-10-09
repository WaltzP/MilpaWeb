import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './fixture.js';
import { AuthError } from '../errors.js';

const errorCode = code => error => error.code === code;
const wrongCode = code => String((Number(code) + 1) % 1000000).padStart(6, '0');
test('registro y confirmación crean una cuenta compartida sin crear perfil ni finca', async () => {
  const f = fixture(), challenge = await f.service.start(f.values);
  assert.equal(challenge.email, 'ana@example.test'); assert.equal(f.users.size, 1);
  const uid = [...f.users.keys()][0]; assert.equal(f.users.get(uid).emailVerified, false);
  assert.equal(f.codes.length, 1); assert.match(f.codes[0].code, /^\d{6}$/);
  const stored = JSON.stringify([...f.documents]);
  assert.ok(!stored.includes(f.codes[0].code)); assert.ok(!stored.includes(f.values.password)); assert.ok(!stored.includes(challenge.challenge));
  const result = JSON.parse((await f.service.confirm(challenge.challenge, f.codes[0].code)).customToken);
  assert.deepEqual(result, { uid, claims: { email_login_verified: true, email_login_address: 'ana@example.test' } });
  assert.equal(f.users.get(uid).emailVerified, true); assert.deepEqual(f.users.get(uid).customClaims, {});
  assert.ok([...f.documents.keys()].every(key => key.startsWith('websiteRegistrationChallenges/')));
  await assert.rejects(f.service.confirm(challenge.challenge, f.codes[0].code), errorCode('INVALID_REGISTRATION_CODE'));
});
test('la cuenta de la app no se duplica ni se sobrescribe', async () => {
  const f = fixture(); const user = await f.auth.createUser({ email: 'ana@example.test', password: 'AppPassword123', emailVerified: true });
  f.users.get(user.uid).customClaims = { milpagrowAdmin: true }; const before = structuredClone(f.users.get(user.uid));
  await assert.rejects(f.service.start(f.values), errorCode('EMAIL_EXISTS'));
  assert.equal(f.users.size, 1); assert.deepEqual(f.users.get(user.uid), before); assert.equal(f.codes.length, 0);
});
test('las reglas de correo, contraseña y confirmación coinciden con la app', async () => {
  const f = fixture();
  for (const email of ['bad', 'a..b@example.test', '.a@example.test', 'a@-example.test', `${'a'.repeat(65)}@example.test`]) {
    await assert.rejects(f.service.start({ ...f.values, email }), errorCode('INVALID_EMAIL'));
  }
  for (const password of ['short1A', 'nouppercase123', 'NoNumbersHere', 'A1'.repeat(65)]) {
    await assert.rejects(f.service.start({ ...f.values, password, confirmPassword: password }), errorCode('WEAK_PASSWORD'));
  }
  await assert.rejects(f.service.start({ ...f.values, confirmPassword: 'OtherPassword123' }), errorCode('PASSWORD_MISMATCH'));
  assert.equal(f.users.size, 0);
});
test('cinco códigos erróneos bloquean también el reenvío y persisten entre instancias', async () => {
  const f = fixture(), data = await f.service.start(f.values), wrong = wrongCode(f.codes[0].code);
  for (let attempt = 0; attempt < 5; attempt++) await assert.rejects(f.service.confirm(data.challenge, wrong), errorCode('INVALID_REGISTRATION_CODE'));
  assert.equal(f.record().attempts, 5); f.advance(61000);
  await assert.rejects(f.makeService().confirm(data.challenge, f.codes[0].code), errorCode('REGISTRATION_LIMIT'));
  await assert.rejects(f.makeService().resend(data.challenge), errorCode('REGISTRATION_LIMIT'));
  assert.equal([...f.users.values()][0].emailVerified, false);
});
test('el código caduca y se puede reenviar respetando el límite', async () => {
  const f = fixture(), data = await f.service.start(f.values);
  await assert.rejects(f.service.resend(data.challenge), errorCode('REGISTRATION_LIMIT'));
  f.advance(600001); await assert.rejects(f.service.confirm(data.challenge, f.codes[0].code), errorCode('INVALID_REGISTRATION_CODE'));
  const resend = await f.service.resend(data.challenge); assert.equal(resend.challenge, data.challenge); assert.equal(f.codes.length, 2);
  assert.equal(f.record().sends, 2); await f.service.confirm(data.challenge, f.codes[1].code);
});
test('sólo una confirmación concurrente puede consumir el código', async () => {
  const f = fixture(), data = await f.service.start(f.values);
  const results = await Promise.allSettled([f.service.confirm(data.challenge, f.codes[0].code), f.service.confirm(data.challenge, f.codes[0].code)]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1); assert.equal(f.updates.length, 1);
});
test('no acepta desafíos falsos ni un cambio de correo, cuenta desactivada o sesión revocada', async () => {
  for (const change of [{ email: 'changed@example.test' }, { disabled: true }, { tokensValidAfterTime: 'revoked' }]) {
    const f = fixture(), data = await f.service.start(f.values); Object.assign([...f.users.values()][0], change);
    await assert.rejects(f.service.confirm(data.challenge, f.codes[0].code), errorCode('INVALID_REGISTRATION_CODE'));
    assert.equal(f.updates.length, 0);
  }
  const f = fixture(); await assert.rejects(f.service.confirm('../bad', '123456'), errorCode('INVALID_REGISTRATION_CODE'));
});
test('un fallo de correo invalida el código sin borrar una cuenta recuperable', async () => {
  const f = fixture(); f.failMail(new AuthError(502, 'MAIL_NETWORK', 'Sin conexión'));
  await assert.rejects(f.service.start(f.values), errorCode('MAIL_NETWORK'));
  assert.equal(f.record().consumed, true); assert.equal(f.users.size, 1); assert.equal([...f.users.values()][0].emailVerified, false);
});
test('el acceso de una cuenta existente exige las mismas claims de correo de MilpaGrow', async () => {
  const f = fixture(), user = await f.auth.createUser({ email: 'app@example.test', emailVerified: true });
  f.users.get(user.uid).customClaims = { milpagrowAdmin: true }; const before = structuredClone(f.users.get(user.uid));
  f.tokens.set('valid', { uid: user.uid, email: user.email, email_login_verified: true, email_login_address: user.email });
  assert.deepEqual(await f.service.session('valid'), { uid: user.uid, email: user.email, emailVerified: true });
  assert.deepEqual(f.users.get(user.uid), before); assert.deepEqual(f.verifications, [{ value: 'valid', revoked: true }]);
  for (const claims of [{}, { email_login_verified: true, email_login_address: 'other@example.test' }, { email_login_verified: false, email_login_address: user.email }]) {
    f.tokens.set('password-only', { uid: user.uid, email: user.email, ...claims });
    await assert.rejects(f.service.session('password-only'), errorCode('MFA_REQUIRED'));
  }
  await assert.rejects(f.service.session('fake'), errorCode('INVALID_TOKEN'));
});
test('un registro interrumpido se recupera con contraseña y código del backend de la app', async () => {
  const f = fixture(), user = await f.auth.createUser({ email: 'pending@example.test', emailVerified: false });
  f.tokens.set('verified-mail-session', { uid: user.uid, email: user.email, email_login_verified: true, email_login_address: user.email });
  await f.service.session('verified-mail-session'); assert.equal(f.users.get(user.uid).emailVerified, true);
  assert.deepEqual(f.updates, [{ uid: user.uid, data: { emailVerified: true } }]); assert.equal(f.documents.size, 0);
});
test('la limitación de registro persiste en Firestore y no guarda la IP', async () => {
  const f = fixture();
  for (let attempt = 0; attempt < 5; attempt++) await f.service.rateLimit('192.0.2.1', 'start');
  await assert.rejects(f.makeService().rateLimit('192.0.2.1', 'start'), errorCode('REGISTRATION_LIMIT'));
  assert.ok(!JSON.stringify([...f.documents]).includes('192.0.2.1'));
  f.advance(3600001); await f.service.rateLimit('192.0.2.1', 'start');
});
