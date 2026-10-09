import { test, expect } from '@playwright/test';

const grant = 'a'.repeat(43);
const apk = `http://127.0.0.1:3001/api/registration/download/${grant}`;
const account = { uid: 'same-app-uid', email: 'ana@example.test', emailVerified: true };
const code = { challenge: 'test-email-challenge', email: account.email, expiresInSeconds: 600, resendAfterSeconds: 60 };
function success(route, data) { return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data }) }); }
function failure(route, message, code, status = 400) { return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ success: false, error: { message, code } }) }); }
async function services(page) {
  const calls = { register: 0, login: 0, confirm: 0, session: 0, firebase: 0 };
  await page.route('**/api/auth/login', route => { calls.login++; expect(route.request().postDataJSON()).toEqual({ email: account.email, password: 'Password123' }); return success(route, code); });
  await page.route('**/api/registration/start', route => { calls.register++; expect(route.request().postDataJSON()).toEqual({ email: account.email, password: 'Password123', confirmPassword: 'Password123' }); return success(route, code); });
  for (const path of ['**/api/auth/login-code/confirm', '**/api/registration/confirm']) await page.route(path, route => {
    calls.confirm++; expect(route.request().postDataJSON().challenge).toBe(code.challenge);
    return route.request().postDataJSON().code === '123456' ? success(route, { customToken: 'verified-custom-token' }) : failure(route, 'El código no es válido o venció.', 'INVALID_LOGIN_CODE');
  });
  const payload = Buffer.from(JSON.stringify({ aud: 'demo-milpagrow', email: account.email, email_verified: true, email_login_verified: true, email_login_address: account.email })).toString('base64url');
  await page.route('https://identitytoolkit.googleapis.com/**', route => {
    calls.firebase++; expect(route.request().postDataJSON()).toEqual({ token: 'verified-custom-token', returnSecureToken: true });
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ idToken: `header.${payload}.signature`, refreshToken: 'private-refresh', expiresIn: '3600' }) });
  });
  await page.route('**/api/registration/session', route => { calls.session++; expect(route.request().headers().authorization).toContain('Bearer header.'); return success(route, account); });
  await page.route('**/api/registration/download-grant', route => {
    expect(route.request().method()).toBe('POST'); expect(route.request().headers().authorization).toContain('Bearer header.');
    return success(route, { grant, expiresInSeconds: 120 });
  });
  await page.route(apk, route => route.fulfill({ contentType: 'application/vnd.android.package-archive', headers: { 'Content-Disposition': 'attachment; filename="MilpaGrow.apk"' }, body: Buffer.from('Download browser fixture') }));
  return calls;
}
async function start(page, registering = false) {
  await page.goto('/acceso.html');
  if (registering) await page.locator('#choose-register').click();
  const form = page.locator(registering ? '#access-register' : '#access-login');
  await form.locator('[name=email]').fill(account.email); await form.locator('[name=password]').fill('Password123');
  if (registering) await form.locator('[name=confirmPassword]').fill('Password123');
  await form.locator('[type=submit]').click(); await expect(page.locator('#access-code')).toBeVisible();
}
async function confirm(page, value = '123456') {
  await page.locator('#access-code-input').fill(value); await page.locator('#access-code [type=submit]').click();
}
test('la cuenta existente de la app exige contraseña y código antes de descargar', async ({ page }) => {
  const calls = await services(page); await start(page);
  await expect(page.locator('#verified-download')).toBeHidden(); await expect(page.locator('#login-password')).toHaveValue('');
  await expect(page.locator('#code-description')).toContainText(account.email); await confirm(page);
  await expect(page.locator('#access-ready')).toBeVisible(); expect(calls).toEqual({ register: 0, login: 1, confirm: 1, session: 1, firebase: 1 });
  const download = page.waitForEvent('download'); await page.locator('#verified-download').click();
  const file = await download; expect(file.suggestedFilename()).toBe('MilpaGrow.apk'); expect(await file.failure()).toBeNull();
});
test('cuenta web: registra, verifica y conserva el instalador y las preguntas de la app', async ({ page }) => {
  const calls = await services(page); await start(page, true);
  expect(calls.register).toBe(1); expect(calls.login).toBe(0); await expect(page.locator('#register-password')).toHaveValue(''); await expect(page.locator('#register-confirm')).toHaveValue('');
  await expect(page.locator('#code-description')).toContainText('Confirma tu registro'); await confirm(page);
  await expect(page.locator('#access-ready')).toContainText('completar tu perfil'); await expect(page.locator('#access-email')).toHaveText(account.email);
  await expect(page.locator('#verified-download')).not.toHaveAttribute('href');
  expect(await page.content()).not.toContain('releases/latest/download');
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]); expect(await page.evaluate(() => Object.keys(sessionStorage))).toEqual([]);
  await page.locator('#access-logout').click(); await expect(page.locator('#access-login')).toBeVisible(); await expect(page.locator('#verified-download')).toBeHidden();
});
test('un permiso denegado no descarga la APK y permite reintentar', async ({ page }) => {
  await services(page); let attempts = 0, downloads = 0;
  page.on('download', () => downloads++);
  await page.route('**/api/registration/download-grant', route => ++attempts === 1
    ? failure(route, 'Confirma nuevamente el código de tu correo.', 'MFA_REQUIRED', 403)
    : success(route, { grant, expiresInSeconds: 120 }));
  await start(page, true); await confirm(page); await page.locator('#verified-download').click();
  await expect(page.locator('#access-status')).toContainText('Confirma nuevamente'); expect(downloads).toBe(0);
  const download = page.waitForEvent('download'); await page.locator('#verified-download').click();
  expect((await download).suggestedFilename()).toBe('MilpaGrow.apk');
});
test('cerrar sesión descarta una autorización de descarga que aún está pendiente', async ({ page }) => {
  await services(page); let held, downloads = 0; page.on('download', () => downloads++);
  await page.route('**/api/registration/download-grant', route => { held = route; });
  await start(page); await confirm(page); await page.locator('#verified-download').click();
  await expect.poll(() => Boolean(held)).toBeTruthy(); await page.locator('#access-logout').click();
  await success(held, { grant, expiresInSeconds: 120 }); await expect(page.locator('#access-login')).toBeVisible();
  expect(downloads).toBe(0); await expect(page.locator('#verified-download')).toBeHidden();
});
test('código incorrecto y vencido no permiten descargar; se puede corregir', async ({ page }) => {
  await services(page); await start(page); await confirm(page, '000000');
  await expect(page.locator('#access-status')).toContainText('no es válido o venció'); await expect(page.locator('#verified-download')).toBeHidden();
  await expect(page.locator('#access-code [type=submit]')).toBeEnabled(); await confirm(page); await expect(page.locator('#access-ready')).toBeVisible();
});
test('la API comprueba la sesión; un canje Firebase por sí solo no muestra la descarga', async ({ page }) => {
  await services(page); await page.route('**/api/registration/session', route => failure(route, 'Confirma el código de correo.', 'MFA_REQUIRED', 403));
  await start(page); await confirm(page); await expect(page.locator('#access-status')).toContainText('Confirma el código'); await expect(page.locator('#verified-download')).toBeHidden();
});
test('un fallo al comprobar la sesión se reintenta sin consumir dos veces el código', async ({ page }) => {
  const calls = await services(page); let attempts = 0;
  await page.route('**/api/registration/session', route => ++attempts === 1 ? route.abort('failed') : success(route, account));
  await start(page); await confirm(page); await expect(page.locator('#access-status')).toContainText('No se pudo conectar');
  await confirm(page); await expect(page.locator('#access-ready')).toBeVisible(); expect(calls.confirm).toBe(1); expect(calls.firebase).toBe(1);
});
test('validación de correo, seguridad de contraseña y confirmación evita crear cuentas incompletas', async ({ page }) => {
  const calls = await services(page); await page.goto('/acceso.html'); await page.locator('#choose-register').click();
  await page.locator('#register-email').fill('a..b@example.test'); await page.locator('#register-password').fill('Password123'); await page.locator('#register-confirm').fill('Password123');
  await page.locator('#access-register [type=submit]').click(); await expect(page.locator('#register-email')).toBeFocused(); expect(calls.register).toBe(0);
  await page.locator('#register-email').fill(account.email); await page.locator('#register-password').fill('weak'); await page.locator('#register-confirm').fill('weak');
  await page.locator('#access-register [type=submit]').click(); await expect(page.locator('#register-password')).toBeFocused(); expect(calls.register).toBe(0);
  await page.locator('#register-password').fill('Password123'); await page.locator('#register-confirm').fill('Different123');
  await page.locator('#access-register [type=submit]').click(); await expect(page.locator('#register-confirm')).toBeFocused(); expect(calls.register).toBe(0);
});
test('una cuenta ya existente invita a iniciar sesión y conserva el correo', async ({ page }) => {
  await services(page); await page.route('**/api/registration/start', route => failure(route, 'Ya existe una cuenta con este correo electrónico. Usa Iniciar sesión.', 'EMAIL_EXISTS', 409));
  await page.goto('/acceso.html'); await page.locator('#choose-register').click();
  await page.locator('#register-email').fill(account.email); await page.locator('#register-password').fill('Password123'); await page.locator('#register-confirm').fill('Password123');
  await page.locator('#access-register [type=submit]').click(); await expect(page.locator('#access-status')).toContainText('Ya existe una cuenta');
  await expect(page.locator('#register-email')).toHaveValue(account.email); await expect(page.locator('#verified-download')).toBeHidden();
});
test('cambiar de cuenta descarta una confirmación tardía sin iniciar la sesión anterior', async ({ page }) => {
  const calls = await services(page); let held;
  await page.route('**/api/auth/login-code/confirm', route => { held = route; }); await start(page); await confirm(page);
  await expect.poll(() => Boolean(held)).toBeTruthy(); await page.locator('#access-restart').click();
  await success(held, { customToken: 'verified-custom-token' }); await expect(page.locator('#access-login')).toBeVisible(); await expect(page.locator('#verified-download')).toBeHidden(); expect(calls.firebase).toBe(0);
});
test('el reenvío respeta la espera y usa los mismos endpoints de correo de la app', async ({ page }) => {
  await page.clock.install(); await services(page); let resends = 0;
  await page.route('**/api/auth/login-code/resend', route => { resends++; expect(route.request().postDataJSON()).toEqual({ challenge: code.challenge }); return success(route, code); });
  await start(page); await expect(page.locator('#access-resend')).toBeDisabled(); await page.clock.fastForward(61000); await expect(page.locator('#access-resend')).toBeEnabled();
  await page.locator('#access-resend').click(); await expect(page.locator('#access-status')).toContainText('Código reenviado'); expect(resends).toBe(1); await expect(page.locator('#access-resend')).toBeDisabled();
});
test('el registro reenvía su código sin crear otra cuenta', async ({ page }) => {
  await page.clock.install(); const calls = await services(page); let resends = 0;
  await page.route('**/api/registration/resend', route => { resends++; return success(route, code); });
  await start(page, true); await page.clock.fastForward(61000); await page.locator('#access-resend').click();
  await expect(page.locator('#access-status')).toContainText('Código reenviado'); expect(resends).toBe(1); expect(calls.register).toBe(1);
});
test('recuperación de contraseña usa Node de MilpaGrow y no revela si existe la cuenta', async ({ page }) => {
  await services(page); let email;
  await page.route('**/api/auth/password-recovery', route => { email = route.request().postDataJSON().email; return success(route, null); });
  await page.goto('/acceso.html'); await page.locator('#login-email').fill(account.email); await page.locator('#choose-recovery').click();
  await expect(page.locator('#recovery-email')).toHaveValue(account.email); await page.locator('#access-recovery [type=submit]').click();
  await expect(page.locator('#access-status')).toContainText('Si existe una cuenta'); expect(email).toBe(account.email); await expect(page.locator('#verified-download')).toBeHidden();
});
test('el acceso conserva el tema, permite ver contraseñas y se adapta a móvil y escritorio', async ({ page }, info) => {
  await services(page); await page.goto('/'); await page.locator('.theme-toggle').click(); await page.locator('.download-link').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark'); await page.locator('#choose-register').click();
  await page.locator('#register-password').fill('Password123'); await page.locator('[data-password=register-password]').click(); await expect(page.locator('#register-password')).toHaveAttribute('type', 'text');
  await page.screenshot({ path: `/tmp/milpaweb-access-${info.project.name}-dark.png`, fullPage: true });
  for (const width of [320, 360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `Desbordamiento a ${width}px`).toBeTruthy();
  }
  await page.locator('#access-theme').click(); await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect.poll(() => page.locator('body').evaluate(element => getComputedStyle(element).backgroundColor)).toBe('rgb(245, 243, 238)');
  await page.screenshot({ path: `/tmp/milpaweb-access-${info.project.name}-light.png`, fullPage: true });
});
