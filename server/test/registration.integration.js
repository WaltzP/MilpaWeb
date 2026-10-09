import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { firebaseServices } from '../firebase.js';
import { registrationService } from '../registration.js';

const emulated = Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST && process.env.FIRESTORE_EMULATOR_HOST);
test('Firebase real emulado: cuentas compartidas en ambos sentidos con el backend original de MilpaGrow', { skip: !emulated }, async t => {
  const projectId = 'demo-milpagrow';
  assert.ok(process.env.FIREBASE_AUTH_EMULATOR_HOST.startsWith('127.0.0.1:'));
  assert.ok(process.env.FIRESTORE_EMULATOR_HOST.startsWith('127.0.0.1:'));
  if (!process.env.MILPAGROW_REPOSITORY_PATH) throw new Error('Indica MILPAGROW_REPOSITORY_PATH para cargar sólo como lectura el backend original.');
  process.env.FIREBASE_PROJECT_ID = projectId;
  process.env.MILPAGROW_FIREBASE_PROJECT_ID = projectId;
  process.env.FIREBASE_API_KEY = 'emulator-public-key';
  process.env.AUTH_TOKEN_SECRET = 'emulator-app-secret-at-least-32-characters';
  process.env.BREVO_API_KEY = 'emulator-private-key';
  process.env.BREVO_FROM_EMAIL = 'emulator@example.test';
  delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  delete process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const originalFetch = global.fetch, mail = [];
  global.fetch = async (url, options) => {
    const value = String(url);
    if (value.startsWith('https://identitytoolkit.googleapis.com/')) return originalFetch(value.replace('https://', `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/`), options);
    if (value === 'https://api.brevo.com/v3/smtp/email') {
      const body = JSON.parse(options.body);
      mail.push({ email: body.to[0].email, code: body.textContent.match(/Tu código: (\d{6})/)[1] });
      return new Response(JSON.stringify({ messageId: 'emulated-brevo' }), { status: 201 });
    }
    throw new Error('La prueba no permite conexiones fuera de los emuladores.');
  };
  t.after(() => { global.fetch = originalFetch; });
  const { auth, db } = firebaseServices();
  const require = createRequire(import.meta.url);
  // Inicializa la instancia del SDK usada por la app antes de importar su
  // firebaseAdmin.js: evita su fallback local a serviceKey.json de producción.
  const appRequire = createRequire(path.join(process.env.MILPAGROW_REPOSITORY_PATH, 'server/package.json'));
  const appAdmin = appRequire('firebase-admin/app');
  appAdmin.initializeApp({ projectId });
  // Se importa el código de la app; no se copia, edita ni despliega ese repositorio.
  const appLogin = require(path.join(process.env.MILPAGROW_REPOSITORY_PATH, 'server/modules/auth/emailLogin.service.js'));
  const appGuard = require(path.join(process.env.MILPAGROW_REPOSITORY_PATH, 'server/middleware/verifyFirebaseToken.js'));
  assert.equal(appAdmin.getApp().options.projectId, projectId);
  const codes = [];
  const service = registrationService({ auth, db, secret: 'emulator-web-secret-at-least-32-characters', sendCode: async (email, code) => { codes.push({ email, code }); } });
  async function exchange(customToken) {
    const result = await global.fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=emulator-public-key', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    });
    assert.equal(result.status, 200); return (await result.json()).idToken;
  }
  async function guard(idToken) {
    let allowed = false, failure;
    await appGuard({ get: () => `Bearer ${idToken}` }, { status: status => ({ json: body => { failure = { status, body }; } }) }, () => { allowed = true; });
    return { allowed, failure };
  }
  await t.test('registro web → correo verificado → login real de la app; perfil pendiente', async () => {
    const email = `web-${randomUUID()}@example.test`, password = 'Password123';
    const data = await service.start({ email, password, confirmPassword: password });
    const before = await auth.getUserByEmail(email); assert.equal(before.emailVerified, false);
    const custom = (await service.confirm(data.challenge, codes.at(-1).code)).customToken;
    const webToken = await exchange(custom), account = await service.session(webToken);
    assert.equal(account.uid, before.uid); assert.equal((await auth.getUser(before.uid)).emailVerified, true);
    assert.equal((await db.collection('users').doc(before.uid).get()).exists, false);
    assert.equal((await guard(webToken)).allowed, true);
    // Mismo método de login que llama AuthApiService de Flutter.
    const challenge = await appLogin.login(email, password);
    assert.equal(challenge.email, email); assert.equal(mail.at(-1).email, email);
    const appToken = await exchange((await appLogin.confirm(challenge.challenge, mail.at(-1).code)).customToken);
    assert.equal((await auth.verifyIdToken(appToken)).uid, before.uid); assert.equal((await guard(appToken)).allowed, true);
    assert.equal((await db.collection('users').doc(before.uid).get()).exists, false);
  });
  await t.test('cuenta creada como en Flutter → login web válido; perfil y permisos intactos', async () => {
    const email = `app-${randomUUID()}@example.test`, password = 'Password123';
    const signup = await global.fetch('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=emulator-public-key', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }),
    });
    assert.equal(signup.status, 200); const created = await signup.json();
    // Una sesión sólo con contraseña todavía no pasa la protección de la app.
    assert.equal((await guard(created.idToken)).allowed, false);
    await auth.updateUser(created.localId, { emailVerified: true });
    await auth.setCustomUserClaims(created.localId, { milpagrowAdmin: true });
    const profile = { uid: created.localId, displayName: 'Productora existente', role: 'owner', farmId: 'existing-farm' };
    await db.collection('users').doc(created.localId).set(profile);
    await assert.rejects(service.start({ email, password, confirmPassword: password }), error => error.code === 'EMAIL_EXISTS');
    const challenge = await appLogin.login(email, password);
    const idToken = await exchange((await appLogin.confirm(challenge.challenge, mail.at(-1).code)).customToken);
    assert.equal((await service.session(idToken)).uid, created.localId); assert.equal((await guard(idToken)).allowed, true);
    assert.deepEqual((await db.collection('users').doc(created.localId).get()).data(), profile);
    assert.equal((await auth.getUser(created.localId)).customClaims.milpagrowAdmin, true);
  });
  const otherCollections = await db.listCollections();
  assert.ok(!otherCollections.some(collection => collection.id === 'farms'));
});
