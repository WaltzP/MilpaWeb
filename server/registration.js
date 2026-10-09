import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { AuthError, invalidCode, limited } from './errors.js';
import { email as validateEmail, password as validatePassword } from './validation.js';

// Las cuentas pertenecen al Firebase de la app. El registro de la web y su
// historial tienen colecciones privadas; no escriben perfiles ni permisos.
export function registrationService({ auth, db, secret, sendCode, now = Date.now }) {
  if (!secret || secret.length < 32) throw new Error('WEBSITE_REGISTRATION_SECRET debe tener al menos 32 caracteres.');
  const ttl = 600000;
  const digest = value => createHmac('sha256', secret).update(value).digest('hex');
  const ref = uid => db.collection('websiteRegistrationChallenges').doc(Buffer.from(uid).toString('base64url'));
  const userRef = uid => db.collection('websiteRegisteredUsers').doc(Buffer.from(uid).toString('base64url'));
  async function trackUser(user, verified, source) {
    const reference = userRef(user.uid);
    await db.runTransaction(async tx => {
      const old = (await tx.get(reference)).data();
      const time = new Date(now());
      tx.set(reference, {
        uid: user.uid, email: user.email, source: old?.source || source,
        createdAt: old?.createdAt || time, emailVerified: verified,
        status: verified ? 'verified' : 'pending',
        verifiedAt: old?.verifiedAt || (verified ? time : null),
        lastVerifiedAt: verified ? time : old?.lastVerifiedAt || null,
        downloadCount: old?.downloadCount || 0, completedDownloadCount: old?.completedDownloadCount || 0,
        lastDownloadAt: old?.lastDownloadAt || null,
      });
    });
  }
  function parse(challenge) {
    if (typeof challenge !== 'string' || !/^[A-Za-z0-9_-]{1,172}\.[A-Za-z0-9_-]{43}$/.test(challenge)) throw invalidCode();
    const uid = Buffer.from(challenge.split('.')[0], 'base64url').toString('utf8');
    return { uid, reference: ref(uid), hash: digest(challenge) };
  }
  function current(record, hash, allowExpired = false) {
    if (!record || record.challengeHash !== hash || record.consumed || (!allowExpired && record.expiresAt <= now())) throw invalidCode();
    if (record.attempts >= 5) throw limited();
  }
  async function issue(uid, challenge, resending = false) {
    const user = await auth.getUser(uid);
    if (user.disabled || !user.email || user.emailVerified) throw new AuthError(403, 'ACCOUNT_UNAVAILABLE', 'Esta cuenta no tiene un registro pendiente. Inicia sesión para continuar.');
    const { reference, hash } = parse(challenge);
    const code = String(randomInt(0, 1000000)).padStart(6, '0');
    const codeHash = digest(`${challenge}:${code}`);
    await db.runTransaction(async tx => {
      const old = (await tx.get(reference)).data();
      if (resending) current(old, hash, true);
      const time = now();
      const sameWindow = old && old.windowStart + 3600000 > time;
      if (old?.sentAt + 60000 > time || (sameWindow && old.sends >= 5)) throw limited();
      tx.set(reference, {
        challengeHash: hash, codeHash, email: user.email, validAfter: user.tokensValidAfterTime || null,
        expiresAt: time + ttl, sentAt: time, consumed: false, attempts: resending ? old.attempts : 0,
        windowStart: sameWindow ? old.windowStart : time, sends: sameWindow ? old.sends + 1 : 1,
        deleteAfter: new Date(time + 86400000),
      });
    });
    try { await sendCode(user.email, code); }
    catch (error) {
      await db.runTransaction(async tx => {
        const record = (await tx.get(reference)).data();
        // No invalida un envío nuevo si otra petición avanzó durante el envío.
        if (record?.codeHash === codeHash) tx.set(reference, { ...record, consumed: true });
      });
      throw error;
    }
    return { challenge, email: user.email, expiresInSeconds: ttl / 1000, resendAfterSeconds: 60 };
  }
  async function start(values = {}) {
    const email = validateEmail(values.email);
    const password = validatePassword(values.password, values.confirmPassword);
    let user;
    try { user = await auth.createUser({ email, password, emailVerified: false }); }
    catch (error) {
      if (error.code === 'auth/email-already-exists') throw new AuthError(409, 'EMAIL_EXISTS', 'Ya existe una cuenta con este correo electrónico. Usa Iniciar sesión.');
      if (error.code === 'auth/invalid-password') throw new AuthError(400, 'WEAK_PASSWORD', 'La contraseña no cumple los requisitos de seguridad.');
      throw error;
    }
    await trackUser(user, false, 'website');
    const challenge = `${Buffer.from(user.uid).toString('base64url')}.${randomBytes(32).toString('base64url')}`;
    return issue(user.uid, challenge);
  }
  async function confirm(challenge, code) {
    const { uid, reference, hash } = parse(challenge);
    if (typeof code !== 'string' || !/^\d{6}$/.test(code)) throw invalidCode();
    const user = await auth.getUser(uid);
    const accepted = await db.runTransaction(async tx => {
      const record = (await tx.get(reference)).data();
      current(record, hash);
      if (user.disabled || user.email !== record.email || (user.tokensValidAfterTime || null) !== record.validAfter) throw invalidCode();
      const expected = Buffer.from(record.codeHash, 'hex');
      const supplied = Buffer.from(digest(`${challenge}:${code}`), 'hex');
      if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
        tx.set(reference, { ...record, attempts: record.attempts + 1 });
        return false;
      }
      tx.set(reference, { ...record, consumed: true });
      return true;
    });
    if (!accepted) throw invalidCode();
    await auth.updateUser(uid, { emailVerified: true });
    await trackUser(user, true, 'website');
    // Claims de ESTA sesión, iguales a los de emailLogin.service de MilpaGrow.
    // No concede permisos ni modifica custom claims permanentes de la cuenta.
    const customToken = await auth.createCustomToken(uid, { email_login_verified: true, email_login_address: user.email });
    return { customToken };
  }
  async function verifiedAccount(idToken) {
    let decoded;
    try { decoded = await auth.verifyIdToken(idToken, true); }
    catch { throw new AuthError(401, 'INVALID_TOKEN', 'Tu sesión ya no es válida. Inicia sesión de nuevo.'); }
    const user = await auth.getUser(decoded.uid);
    if (user.disabled || !user.email || user.email !== decoded.email || decoded.email_login_verified !== true || decoded.email_login_address !== user.email) {
      throw new AuthError(403, 'MFA_REQUIRED', 'Confirma el código enviado a tu correo para continuar.');
    }
    // Una cuenta que quedó sin verificar (correo perdido o registro desde la
    // app) ya probó su contraseña y correo con el código del backend existente.
    if (!user.emailVerified) await auth.updateUser(user.uid, { emailVerified: true });
    return { ...user, emailVerified: true };
  }
  async function session(idToken) {
    const user = await verifiedAccount(idToken);
    await trackUser(user, true, 'app');
    return { uid: user.uid, email: user.email, emailVerified: true };
  }
  const grants = db.collection('websiteDownloadGrants');
  const invalidGrant = () => new AuthError(403, 'DOWNLOAD_GRANT_INVALID', 'El permiso de descarga venció o ya se usó. Vuelve a solicitar la descarga.');
  function grantRef(grant) {
    if (typeof grant !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(grant)) throw invalidGrant();
    return grants.doc(digest(grant));
  }
  async function grant(idToken) {
    const user = await verifiedAccount(idToken);
    await rateLimit(user.uid, 'download');
    await trackUser(user, true, 'app');
    const value = randomBytes(32).toString('base64url');
    await db.runTransaction(async tx => tx.set(grantRef(value), {
      uid: user.uid, email: user.email, validAfter: user.tokensValidAfterTime || null,
      createdAt: new Date(now()), expiresAt: now() + 120000, consumed: false,
      deleteAfter: new Date(now() + 86400000),
    }));
    return { grant: value, expiresInSeconds: 120 };
  }
  function checkGrant(record) {
    if (!record || record.consumed || record.expiresAt <= now()) throw invalidGrant();
  }
  async function checkDownload(value) {
    const reference = grantRef(value);
    const record = await db.runTransaction(async tx => (await tx.get(reference)).data());
    checkGrant(record);
    const user = await auth.getUser(record.uid);
    if (user.disabled || !user.emailVerified || user.email !== record.email || (user.tokensValidAfterTime || null) !== record.validAfter) throw invalidGrant();
    return record;
  }
  async function beginDownload(value, { sizeBytes, version }) {
    await checkDownload(value);
    const reference = grantRef(value), event = db.collection('websiteDownloads').doc(reference.id);
    await db.runTransaction(async tx => {
      const record = (await tx.get(reference)).data();
      checkGrant(record);
      const accountRef = userRef(record.uid), account = (await tx.get(accountRef)).data();
      const time = new Date(now());
      tx.set(reference, { ...record, consumed: true });
      tx.set(event, { uid: record.uid, email: record.email, filename: 'MilpaGrow.apk', version, sizeBytes, status: 'started', startedAt: time, finishedAt: null });
      tx.set(accountRef, { ...account, downloadCount: (account?.downloadCount || 0) + 1, lastDownloadAt: time });
    });
    return event;
  }
  async function finishDownload(event, completed) {
    await db.runTransaction(async tx => {
      const record = (await tx.get(event)).data();
      if (!record || record.status !== 'started') return;
      const reference = userRef(record.uid), account = (await tx.get(reference)).data();
      tx.set(event, { ...record, status: completed ? 'completed' : 'failed', finishedAt: new Date(now()) });
      if (completed) tx.set(reference, { ...account, completedDownloadCount: (account?.completedDownloadCount || 0) + 1 });
    });
  }
  async function registeredUsers(idToken, cursor) {
    const user = await verifiedAccount(idToken);
    // Comprueba el permiso actual, aunque el token todavía tenga claims antiguos.
    if (user.customClaims?.milpagrowAdmin !== true) throw new AuthError(403, 'ADMIN_REQUIRED', 'Esta cuenta no tiene permiso administrativo.');
    let query = db.collection('websiteRegisteredUsers').orderBy('createdAt', 'desc');
    if (cursor !== undefined) {
      if (typeof cursor !== 'string' || !/^[A-Za-z0-9_-]{1,172}$/.test(cursor)) throw new AuthError(400, 'INVALID_CURSOR', 'La página de usuarios no es válida.');
      const previous = await db.collection('websiteRegisteredUsers').doc(cursor).get();
      if (!previous.exists) throw new AuthError(400, 'INVALID_CURSOR', 'La página de usuarios ya no está disponible.');
      query = query.startAfter(previous);
    }
    const page = await query.limit(51).get(), documents = page.docs.slice(0, 50);
    const date = value => value?.toDate ? value.toDate().toISOString() : value ? new Date(value).toISOString() : null;
    return { items: documents.map(document => {
      const value = document.data();
      return { uid: value.uid, email: value.email, status: value.status, source: value.source,
        createdAt: date(value.createdAt), verifiedAt: date(value.verifiedAt), lastDownloadAt: date(value.lastDownloadAt),
        downloadCount: value.downloadCount || 0, completedDownloadCount: value.completedDownloadCount || 0 };
    }), nextCursor: page.docs.length > 50 ? documents.at(-1).id : null };
  }
  async function rateLimit(ip, action) {
    const reference = db.collection('websiteRegistrationRateLimits').doc(digest(`${action}:${ip}`));
    const max = action === 'start' ? 5 : action === 'download' ? 10 : 60;
    await db.runTransaction(async tx => {
      const record = (await tx.get(reference)).data();
      const time = now();
      const active = record && record.windowStart + 3600000 > time;
      if (active && record.requests >= max) throw limited();
      tx.set(reference, { windowStart: active ? record.windowStart : time, requests: active ? record.requests + 1 : 1, deleteAfter: new Date(time + 86400000) });
    });
  }
  return { start, confirm, session, grant, checkDownload, beginDownload, finishDownload, registeredUsers, rateLimit,
    resend: challenge => { const { uid } = parse(challenge); return issue(uid, challenge, true); } };
}
