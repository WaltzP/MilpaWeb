import { test, expect } from '@playwright/test';
const release = { id: 'android-12', version: '1.2.0', versionCode: 12, minAndroid: '7.0', notes: 'Mejoras de registro y seguimiento.', sizeBytes: 128974848, publishedAt: '2026-10-08T12:00:00Z', downloadUrl: 'https://github.com/WaltzP/MilpaWeb/releases/download/v1.2.0/MilpaGrow.apk', sha256: 'abc' };
function success(route, data, status = 200) { return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ success: true, data }) }); }
function failure(route, message, code, status = 503) { return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ success: false, error: { message, code } }) }); }
async function publicApi(page, current = () => release) {
  await page.route('**/api/website/release', route => success(route, current()));
  await page.route('**/api/website/demo-challenge', route => success(route, { challenge: 'test-challenge', minWaitMs: 0 }));
}
async function demoFields(page) {
  await page.locator('#demo-form [name=name]').fill('Ana Productora'); await page.locator('#demo-form [name=email]').fill('ana@example.test'); await page.locator('#demo-form [name=activity]').selectOption('mixta'); await page.locator('#demo-form [name=message]').fill('Quiero organizar los registros de mi finca.');
}
test('landing conserva interacciones, menú, temas y consulta nuevas versiones sin reconstruir', async ({ page }, info) => {
  let current = release; await publicApi(page, () => current); await page.goto('/');
  await expect(page.locator('.download-link')).toHaveAttribute('href', release.downloadUrl);
  await expect(page.locator('#apk-version')).toHaveText('1.2.0'); await expect(page.locator('#apk-size')).toContainText('123');
  await page.locator('#tab-porcino').click(); await expect(page.locator('#module-title')).toContainText('cerdos');
  await page.locator('#tab-porcino').press('ArrowRight'); await expect(page.locator('#tab-diagnostico')).toBeFocused();
  await page.locator('[data-question=finca]').click(); await expect(page.locator('#chat-answer')).toContainText('áreas productivas');
  await page.locator('.theme-toggle').click(); await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  if (info.project.name === 'mobile') { await page.locator('.menu-toggle').click(); await expect(page.locator('#mobile-nav')).toBeVisible(); await page.locator('#mobile-nav a[href="#demostracion"]').click(); await expect(page.locator('#mobile-nav')).toBeHidden(); }
  current = { ...release, version: '1.3.0', versionCode: 13, downloadUrl: release.downloadUrl.replace('1.2.0', '1.3.0') };
  await page.reload(); await expect(page.locator('#apk-version')).toHaveText('1.3.0'); await expect(page.locator('.download-link')).toHaveAttribute('href', current.downloadUrl);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  for (const width of [320, 360, 768, 900, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `Desbordamiento a ${width}px`).toBeTruthy();
  }
});
test('demo: error conserva campos; respuesta perdida se reintenta con la misma clave', async ({ page }) => {
  await publicApi(page); let attempts = 0; const saved = new Map(); const keys = [];
  await page.route('**/api/website/demo-requests', async route => {
    const key = route.request().headers()['idempotency-key']; keys.push(key); saved.set(key, route.request().postDataJSON());
    if (++attempts === 1) await route.abort('failed'); else await success(route, { accepted: true }, 202);
  });
  await page.goto('/'); await demoFields(page); await page.locator('#demo-form [type=submit]').click();
  await expect(page.locator('#demo-status')).toContainText('Tus datos siguen'); await expect(page.locator('#demo-form [name=name]')).toHaveValue('Ana Productora'); await expect(page.locator('#demo-status')).not.toContainText('¡Solicitud recibida!');
  await page.locator('#demo-form [type=submit]').click(); await expect(page.locator('#demo-status')).toContainText('¡Solicitud recibida!');
  expect(keys[0]).toBe(keys[1]); expect(saved.size).toBe(1); await expect(page.locator('#demo-form [name=name]')).toHaveValue('');
});
test('validación del navegador y error al consultar descarga', async ({ page }) => {
  await page.route('**/api/website/release', route => failure(route, 'Servicio temporalmente no disponible.', 'WEBSITE_CONFIG'));
  await page.route('**/api/website/demo-challenge', route => success(route, { challenge: 'test', minWaitMs: 0 }));
  let submissions = 0; await page.route('**/api/website/demo-requests', route => { submissions++; return success(route, { accepted: true }, 202); });
  await page.goto('/'); await expect(page.locator('.download-link')).toHaveAttribute('aria-disabled', 'true'); await expect(page.locator('#release-retry')).toBeVisible();
  await demoFields(page); await page.locator('#demo-form [name=name]').fill('  '); await page.locator('#demo-form [type=submit]').click(); expect(submissions).toBe(0); await expect(page.locator('#demo-form [name=name]')).toBeFocused();
  await page.locator('#demo-form [name=name]').fill('Ana'); await page.locator('#demo-form [name=email]').fill('invalid'); await page.locator('#demo-form [type=submit]').click(); expect(submissions).toBe(0);
});
async function authApi(page, denied = false) {
  await page.route('**/api/auth/login', route => success(route, { challenge: 'email-challenge', email: 'admin@example.test', expiresInSeconds: 600, resendAfterSeconds: 60 }));
  await page.route('**/api/auth/login-code/confirm', route => success(route, { customToken: 'test-custom-token' }));
  const payload = Buffer.from(JSON.stringify({ aud: 'demo-milpagrow' })).toString('base64url');
  await page.route('https://identitytoolkit.googleapis.com/**', route => successFirebase(route, { idToken: `header.${payload}.signature`, refreshToken: 'test-refresh', expiresIn: '3600' }));
  await page.route('**/api/website/admin/session', route => denied ? failure(route, 'Acceso denegado. Esta cuenta no tiene permiso administrativo.', 'ADMIN_REQUIRED', 403) : success(route, { uid: 'admin', email: 'admin@example.test' }));
}
function successFirebase(route, data) { return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) }); }
async function login(page) {
  await page.goto('/admin.html'); await page.locator('#login-form [name=email]').fill('admin@example.test'); await page.locator('#login-form [name=password]').fill('DemoPassword123'); await page.locator('#login-form [type=submit]').click(); await page.locator('#code-form [name=code]').fill('123456'); await page.locator('#code-form [type=submit]').click();
}
test('cuenta sin permiso: acceso denegado y panel privado oculto', async ({ page }) => {
  await authApi(page, true); await login(page); await expect(page.locator('#login-status')).toContainText('Acceso denegado'); await expect(page.locator('#admin-panel')).toBeHidden();
});
test('cambiar cuenta descarta una verificación de acceso que aún está pendiente', async ({ page }) => {
  await authApi(page); let confirmation, firebaseExchanges = 0;
  page.on('request', request => { if (request.url().includes('identitytoolkit.googleapis.com')) firebaseExchanges++; });
  await page.route('**/api/auth/login-code/confirm', route => { confirmation = route; });
  await login(page); await expect.poll(() => Boolean(confirmation)).toBeTruthy(); await expect(page.locator('#login-status')).toContainText('Verificando'); await page.locator('#restart-login').click();
  await success(confirmation, { customToken: 'late-test-token' }); await expect(page.locator('#code-form [type=submit]')).toBeEnabled(); await expect(page.locator('#login-form')).toBeVisible(); await expect(page.locator('#admin-panel')).toBeHidden();
  expect(firebaseExchanges).toBe(0);
});
test('panel: listas vacías, fallo de carga y reintento de APK conservan la versión', async ({ page }) => {
  await authApi(page); let registered = 0, uploaded = 0, current = null, versions = [];
  await page.route('**/api/website/admin/demo-requests?**', route => success(route, { items: [], nextCursor: null }));
  await page.route('**/api/website/admin/releases', route => {
    if (route.request().method() === 'POST') { registered++; versions = [{ ...release, ...route.request().postDataJSON(), status: 'draft' }]; return success(route, versions[0], 201); }
    return success(route, { items: versions, nextCursor: null, currentReleaseId: current?.id || null, maxBytes: 262144000 });
  });
  await page.route('**/api/website/admin/releases/android-12/apk', route => {
    if (++uploaded === 1) { versions[0].status = 'failed'; return failure(route, 'GitHub no completó la carga.', 'GITHUB_ERROR', 502); }
    versions[0].status = 'uploaded'; return success(route, versions[0]);
  });
  await login(page); await expect(page.locator('#demos-status')).toContainText('Todavía no hay solicitudes'); await page.locator('#tab-releases').click(); await expect(page.locator('#releases-status')).toContainText('Todavía no hay instaladores');
  await page.locator('#release-form [name=version]').fill('1.2.0'); await page.locator('#release-form [name=versionCode]').fill('12'); await page.locator('#release-form [name=notes]').fill(release.notes); await page.locator('#release-form [name=apk]').setInputFiles({ name: 'MilpaGrow.apk', mimeType: 'application/vnd.android.package-archive', buffer: Buffer.from('browser fixture') });
  await page.locator('#release-form [type=submit]').click(); await expect(page.locator('#release-form-status')).toContainText('se conservan'); await expect(page.locator('#release-form [name=version]')).toHaveValue('1.2.0'); await expect(page.locator('#release-form [name=notes]')).toHaveValue(release.notes); expect(current).toBeNull();
  await page.locator('#release-form [type=submit]').click(); await expect(page.locator('#upload-status')).toContainText('Carga completa'); expect(registered).toBe(1); expect(uploaded).toBe(2);
});
test('administrador gestiona demo, sube archivo, publica y landing ofrece esa versión', async ({ page }, info) => {
  await authApi(page); let current = null; await publicApi(page, () => current);
  const demo = { id: 'demo-1', name: 'Ana <img src=x onerror=alert(1)>', email: 'ana@example.test', phone: '', activity: 'mixta', message: 'Quiero organizar mi finca.', status: 'pendiente', notes: '', revision: 0, createdAt: Date.now() };
  let versions = [], uploaded = false, patched = false;
  await page.route('**/api/website/admin/demo-requests?**', route => success(route, { items: [demo], nextCursor: null }));
  await page.route('**/api/website/admin/demo-requests/demo-1', route => {
    if (route.request().method() === 'PATCH') { Object.assign(demo, route.request().postDataJSON()); demo.revision++; patched = true; }
    return success(route, demo);
  });
  await page.route('**/api/website/admin/releases', route => {
    if (route.request().method() === 'POST') { versions = [{ ...release, ...route.request().postDataJSON(), status: 'draft' }]; return success(route, versions[0], 201); }
    return success(route, { items: versions, nextCursor: null, currentReleaseId: current?.id || null, maxBytes: 262144000 });
  });
  await page.route('**/api/website/admin/releases/android-12/apk', route => { expect(route.request().method()).toBe('PUT'); expect(route.request().headers().authorization).toContain('Bearer '); expect(route.request().postDataBuffer().length).toBeGreaterThan(0); uploaded = true; versions[0].status = 'uploaded'; return success(route, versions[0]); });
  await page.route('**/api/website/admin/releases/android-12/publish', route => { expect(uploaded).toBeTruthy(); versions[0].status = 'published'; current = versions[0]; return success(route, current); });
  await login(page); await expect(page.locator('#admin-panel')).toBeVisible(); await page.getByRole('button', { name: 'Ver solicitud', exact: true }).click();
  await expect(page.locator('#detail-data')).toContainText(demo.name); expect(await page.locator('#detail-data img').count()).toBe(0);
  await page.locator('#detail-form [name=status]').selectOption('agendada'); await page.locator('#detail-form [name=notes]').fill('Demo acordada para el viernes.'); await page.locator('#detail-form [type=submit]').click(); await expect(page.locator('#detail-status')).toContainText('guardado'); expect(patched).toBeTruthy();
  await page.locator('#tab-releases').click(); await page.locator('#release-form [name=version]').fill('1.2.0'); await page.locator('#release-form [name=versionCode]').fill('12'); await page.locator('#release-form [name=notes]').fill(release.notes); await page.locator('#release-form [name=apk]').setInputFiles({ name: 'MilpaGrow.apk', mimeType: 'application/vnd.android.package-archive', buffer: Buffer.from('Browser fixture; real APK validated by backend integration test') });
  await page.locator('#release-form [type=submit]').click(); await expect(page.locator('#upload-status')).toContainText('Carga completa'); await expect(page.locator('#apk-progress')).toHaveAttribute('value', '100');
  await page.getByRole('button', { name: 'Publicar y ofrecer en la landing', exact: true }).click(); await expect(page.locator('#releases-list')).toContainText('Disponible en la landing');
  await page.screenshot({ path: `/tmp/milpagrow-sprint2-${info.project.name}-admin-light.png`, fullPage: true });
  await page.locator('#admin-theme').click(); await expect.poll(() => page.locator('body').evaluate(element => getComputedStyle(element).backgroundColor)).toBe('rgb(14, 40, 24)'); await page.screenshot({ path: `/tmp/milpagrow-sprint2-${info.project.name}-admin-dark.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.goto('/'); await expect(page.locator('.download-link')).toHaveAttribute('href', release.downloadUrl); await expect(page.locator('#apk-version')).toHaveText('1.2.0');
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual(['milpagrow-theme']);
});
test('movimiento reducido, foco visible y formularios sin desbordamiento en ambos temas', async ({ page }, info) => {
  await publicApi(page); await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/');
  await page.locator('.hero-actions a[href="#demostracion"]').focus(); const outline = await page.locator('.hero-actions a[href="#demostracion"]').evaluate(element => getComputedStyle(element).outlineStyle); expect(outline).not.toBe('none');
  expect(await page.locator('.hero-milpi').evaluate(element => getComputedStyle(element).animationName)).toBe('none');
  await page.locator('#demostracion').scrollIntoViewIfNeeded(); await page.locator('#demostracion').screenshot({ path: `/tmp/milpagrow-sprint2-${info.project.name}-form-light.png` });
  await page.locator('.theme-toggle').click(); await page.locator('#demostracion').scrollIntoViewIfNeeded(); await page.locator('#demostracion').screenshot({ path: `/tmp/milpagrow-sprint2-${info.project.name}-form-dark.png` });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});
