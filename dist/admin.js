import { request, apiUrl, ApiError, status, formatDate, formatSize, node } from './website-api.js';
import { signIn, signOut, token } from './firebase-session.js';
import { registrationRequest } from './registration-api.js';
const $ = selector => document.querySelector(selector);
let challenge, resendAt = 0, active = false, generation = 0, demoCursor, releaseCursor, detail, uploadId, uploading = false;
let demoLoading = false, releaseLoading = false, selectedStatus = '', maxBytes = 250 * 1024 * 1024;
let uploadRequest;
let userCursor, userLoading = false;
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $('#admin-theme').textContent = theme === 'dark' ? 'Tema claro' : 'Tema oscuro';
  document.querySelector('meta[name=theme-color]').content = theme === 'dark' ? '#0E2818' : '#F5F3EE';
}
try { const theme = localStorage.getItem('milpagrow-theme'); if (['light', 'dark'].includes(theme)) applyTheme(theme); } catch {}
$('#admin-theme').addEventListener('click', () => { const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; applyTheme(theme); try { localStorage.setItem('milpagrow-theme', theme); } catch {} });
function logout(message = '') {
  active = false; generation++; detailRun++; signOut(); uploadRequest?.abort();
  challenge = undefined; detail = undefined; uploadId = undefined;
  $('#admin-panel').hidden = true; $('#login-section').hidden = false;
  $('#login-form').hidden = false; $('#code-form').hidden = true;
  $('#code-form').reset(); $('#login-form').reset(); $('#release-form').reset(); $('#detail-form').reset();
  $('#demo-detail').hidden = true; $('#demos-list').replaceChildren(); $('#releases-list').replaceChildren();
  $('#users-list').replaceChildren(); userCursor = undefined; $('#more-users').hidden = true;
  $('#detail-data').replaceChildren(); $('#session-email').textContent = ''; status($('#login-status'), message, Boolean(message));
  for (const name of ['version', 'versionCode', 'minAndroid', 'notes']) $('#release-form').elements[name].disabled = false;
}
$('#logout').addEventListener('click', () => logout());
$('#restart-login').addEventListener('click', () => logout());
async function admin(path, options) {
  const run = generation;
  try { return await request(`/website/admin${path}`, { ...options, token: await token() }); }
  catch (error) {
    if (run === generation && (error.status === 401 || ['ADMIN_REQUIRED', 'EMAIL_NOT_VERIFIED', 'MFA_REQUIRED'].includes(error.code))) logout(error.message);
    throw error;
  }
}
$('#login-form').addEventListener('submit', async event => {
  event.preventDefault(); const run = generation; const form = event.currentTarget; const button = form.querySelector('button'); button.disabled = true;
  status($('#login-status'), 'Comprobando tu cuenta y enviando el código…');
  try {
    const data = await request('/auth/login', { method: 'POST', body: { email: form.elements.email.value.trim(), password: form.elements.password.value } });
    if (run !== generation) return;
    challenge = data.challenge; resendAt = Date.now() + data.resendAfterSeconds * 1000;
    form.elements.password.value = ''; form.hidden = true; $('#code-form').hidden = false;
    $('#code-description').textContent = `Enviamos un código a ${data.email}. Es válido por ${Math.round(data.expiresInSeconds / 60)} minutos.`;
    status($('#login-status'), 'Revisa tu correo y escribe el código de seis dígitos.'); $('#code-form').elements.code.focus();
  } catch (error) { status($('#login-status'), error.message, true); }
  finally { button.disabled = false; }
});
$('#resend-code').addEventListener('click', async () => {
  if (Date.now() < resendAt) { status($('#login-status'), `Podrás reenviar el código en ${Math.ceil((resendAt - Date.now()) / 1000)} segundos.`, true); return; }
  const button = $('#resend-code'); button.disabled = true;
  try { const data = await request('/auth/login-code/resend', { method: 'POST', body: { challenge } }); resendAt = Date.now() + data.resendAfterSeconds * 1000; status($('#login-status'), 'Código reenviado. Revisa tu correo.'); }
  catch (error) { status($('#login-status'), error.message, true); }
  finally { button.disabled = false; }
});
$('#code-form').addEventListener('submit', async event => {
  event.preventDefault(); const run = generation; const button = event.currentTarget.querySelector('[type=submit]'); button.disabled = true;
  status($('#login-status'), 'Verificando tu acceso…');
  try {
    const result = await request('/auth/login-code/confirm', { method: 'POST', body: { challenge, code: event.currentTarget.elements.code.value } });
    if (run !== generation) return;
    await signIn(result.customToken, () => run === generation);
    if (run !== generation) return;
    const session = await admin('/session');
    if (run !== generation) return;
    active = true; generation++; $('#code-form').reset(); $('#login-section').hidden = true; $('#admin-panel').hidden = false;
    $('#session-email').textContent = `Sesión de ${session.email}`; status($('#login-status'), '');
    await Promise.all([loadDemos(), loadReleases()]);
  } catch (error) { if (run === generation) { signOut(); status($('#login-status'), error.message, true); } }
  finally { button.disabled = false; }
});
const tabs = [...document.querySelectorAll('[data-panel]')];
function selectTab(tab) {
  tabs.forEach(item => { const selected = item === tab; item.setAttribute('aria-selected', String(selected)); item.tabIndex = selected ? 0 : -1; $(`#panel-${item.dataset.panel}`).hidden = !selected; });
  if (tab.dataset.panel === 'users') loadUsers();
}
tabs.forEach((tab, index) => { tab.addEventListener('click', () => selectTab(tab)); tab.addEventListener('keydown', event => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { event.preventDefault(); const next = tabs[event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length]; selectTab(next); next.focus(); } }); });
async function loadUsers(append = false) {
  if (!active || userLoading) return;
  const run = generation; userLoading = true;
  $('#refresh-users').disabled = true; $('#more-users').disabled = true; status($('#users-status'), 'Cargando usuarios…');
  try {
    const result = await registrationRequest(`/users${append && userCursor ? `?cursor=${encodeURIComponent(userCursor)}` : ''}`, { token: await token() });
    if (!active || run !== generation) return;
    if (!append) $('#users-list').replaceChildren();
    for (const item of result.items) {
      const card = node('article', undefined, 'clay-card admin-item'), content = node('div');
      content.append(node('strong', item.email), node('p', `Registro: ${formatDate(item.createdAt)} · ${item.source === 'website' ? 'Cuenta creada en la web' : 'Cuenta de la app'}`));
      content.append(node('p', `${item.downloadCount} descargas iniciadas · ${item.completedDownloadCount} entregadas`));
      if (item.lastDownloadAt) content.append(node('p', `Última descarga: ${formatDate(item.lastDownloadAt)}`));
      card.append(content, node('span', item.status === 'verified' ? 'Correo verificado' : 'Verificación pendiente', 'state-badge'));
      $('#users-list').append(card);
    }
    userCursor = result.nextCursor; $('#more-users').hidden = !userCursor;
    status($('#users-status'), result.items.length ? '' : 'Todavía no hay usuarios registrados desde la web.');
  } catch (error) {
    if (!active || run !== generation) return;
    if (error.status === 401 || error.code === 'ADMIN_REQUIRED' || error.code === 'MFA_REQUIRED') logout(error.message);
    else status($('#users-status'), `${error.message} Puedes volver a intentar con Actualizar usuarios.`, true);
  } finally { userLoading = false; $('#refresh-users').disabled = false; $('#more-users').disabled = false; }
}
$('#refresh-users').addEventListener('click', () => loadUsers()); $('#more-users').addEventListener('click', () => loadUsers(true));
async function loadDemos(append = false) {
  if (!active || demoLoading) return; demoLoading = true; const run = generation;
  selectedStatus = $('#demo-filter').value; $('#demo-filter').disabled = true; $('#refresh-demos').disabled = true; $('#more-demos').disabled = true;
  status($('#demos-status'), 'Cargando solicitudes…');
  try {
    const params = new URLSearchParams(); if (selectedStatus) params.set('status', selectedStatus); if (append && demoCursor) params.set('cursor', demoCursor);
    const result = await admin(`/demo-requests?${params}`); if (!active || run !== generation) return;
    if (!append) $('#demos-list').replaceChildren();
    for (const item of result.items) {
      const card = node('article', undefined, 'clay-card admin-item'); const content = node('div');
      content.append(node('strong', item.name), node('p', `${item.email} · ${formatDate(item.createdAt)}`));
      const badge = node('span', item.status, 'state-badge'); const button = node('button', 'Ver solicitud', 'text-link'); button.addEventListener('click', () => openDetail(item.id));
      card.append(content, badge, button); $('#demos-list').append(card);
    }
    demoCursor = result.nextCursor; $('#more-demos').hidden = !demoCursor;
    status($('#demos-status'), $('#demos-list').childElementCount ? '' : 'Todavía no hay solicitudes para este estado.');
  } catch (error) { if (active) status($('#demos-status'), `${error.message} Puedes volver a intentar con Actualizar.`, true); }
  finally { demoLoading = false; $('#demo-filter').disabled = false; $('#refresh-demos').disabled = false; $('#more-demos').disabled = false; }
}
$('#demo-filter').addEventListener('change', () => loadDemos()); $('#refresh-demos').addEventListener('click', () => loadDemos()); $('#more-demos').addEventListener('click', () => loadDemos(true));
let detailRun = 0;
async function openDetail(id) {
  const run = ++detailRun; detail = undefined; $('#demo-detail').hidden = false; $('#detail-data').replaceChildren(); $('#detail-form').hidden = true; status($('#detail-status'), 'Cargando detalle…');
  try {
    const data = await admin(`/demo-requests/${encodeURIComponent(id)}`); if (!active || run !== detailRun) return;
    detail = data; $('#detail-data').replaceChildren();
    for (const [label, value] of [['Nombre', data.name], ['Correo', data.email], ['Teléfono', data.phone || 'No indicado'], ['Actividad', data.activity], ['Recibida', formatDate(data.createdAt)], ['Mensaje', data.message]]) { const group = node('div'); group.append(node('dt', label), node('dd', value)); $('#detail-data').append(group); }
    $('#detail-form').elements.status.value = data.status; $('#detail-form').elements.notes.value = data.notes; $('#detail-form').hidden = false; status($('#detail-status'), '');
    $('#demo-detail').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  } catch (error) { if (active && run === detailRun) status($('#detail-status'), `${error.message} Vuelve a abrir la solicitud para intentar de nuevo.`, true); }
}
$('#close-detail').addEventListener('click', () => { detailRun++; detail = undefined; $('#demo-detail').hidden = true; });
$('#detail-form').addEventListener('submit', async event => {
  event.preventDefault(); if (!detail) return; const current = detail; const run = detailRun; const form = event.currentTarget; const button = form.querySelector('button'); button.disabled = true; status($('#detail-status'), 'Guardando seguimiento…');
  try {
    const result = await admin(`/demo-requests/${current.id}`, { method: 'PATCH', body: { status: form.elements.status.value, notes: form.elements.notes.value, revision: current.revision } });
    if (active && run === detailRun) { detail = result; status($('#detail-status'), 'Seguimiento guardado.'); await loadDemos(); }
  } catch (error) { if (active && run === detailRun) status($('#detail-status'), `${error.message} Tus notas siguen aquí.`, true); }
  finally { button.disabled = false; }
});
function upload(id, file) {
  $('#upload-progress').hidden = false; $('#apk-progress').value = 0; status($('#upload-status'), 'Enviando el archivo al servidor…');
  return token().then(idToken => new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest(); uploadRequest = xhr;
    xhr.open('PUT', apiUrl(`/website/admin/releases/${id}/apk`)); xhr.timeout = 15 * 60 * 1000;
    xhr.setRequestHeader('Authorization', `Bearer ${idToken}`); xhr.setRequestHeader('Content-Type', 'application/vnd.android.package-archive');
    xhr.upload.onprogress = event => { if (event.lengthComputable) { const percent = Math.round(event.loaded / event.total * 100); $('#apk-progress').value = percent; status($('#upload-status'), percent < 100 ? `Enviando archivo: ${percent}%` : 'Archivo recibido. Validando y completando la carga en GitHub…'); } };
    xhr.onerror = xhr.ontimeout = () => reject(new ApiError('La carga perdió la conexión. Consulta el historial y vuelve a intentar.'));
    xhr.onabort = () => reject(new ApiError('La carga fue interrumpida.'));
    xhr.onload = () => { let data; try { data = JSON.parse(xhr.responseText); } catch {} if (xhr.status >= 200 && xhr.status < 300 && data?.success) resolve(data.data); else { const error = new ApiError(data?.error?.message || 'La carga no se pudo completar.', data?.error?.code, xhr.status); if ([401, 403].includes(xhr.status)) logout(error.message); reject(error); } };
    xhr.send(file);
  })).finally(() => { uploadRequest = undefined; });
}
function validFile(file) {
  if (!file || !/\.apk$/i.test(file.name) || !file.size) throw new ApiError('Selecciona un archivo APK real.');
  if (file.size > maxBytes) throw new ApiError(`El tamaño máximo del APK es ${formatSize(maxBytes)}.`);
}
$('#release-form').addEventListener('submit', async event => {
  event.preventDefault(); if (uploading) return; const form = event.currentTarget; const button = form.querySelector('[type=submit]');
  try {
    const file = form.elements.apk.files[0]; validFile(file); uploading = true; button.disabled = true;
    const body = { version: form.elements.version.value.trim(), versionCode: Number(form.elements.versionCode.value), minAndroid: form.elements.minAndroid.value.trim(), notes: form.elements.notes.value.trim() };
    if (body.notes.length < 10) throw new ApiError('Describe las novedades con al menos 10 caracteres.');
    status($('#release-form-status'), 'Registrando la versión…');
    if (!uploadId) { const created = await admin('/releases', { method: 'POST', body }); uploadId = created.id; }
    // Un reintento conserva el ID; los metadatos quedan bloqueados hasta completarlo.
    for (const name of ['version', 'versionCode', 'minAndroid', 'notes']) form.elements[name].disabled = true;
    await upload(uploadId, file);
    status($('#upload-status'), 'Carga completa en GitHub.'); status($('#release-form-status'), 'Instalador listo para publicar desde el historial. La descarga protegida usa el archivo configurado en el servicio de registro.');
    uploadId = undefined; form.reset(); $('#apk-progress').value = 100;
  } catch (error) { if (active) status($('#release-form-status'), `${error.message} Los datos y el archivo seleccionado se conservan para reintentar.`, true); }
  finally {
    uploading = false; button.disabled = false;
    if (!uploadId) for (const name of ['version', 'versionCode', 'minAndroid', 'notes']) form.elements[name].disabled = false;
    if (active) await loadReleases();
  }
});
const releaseLabels = { draft: 'Por cargar', uploading: 'Carga en curso', uploaded: 'Lista para publicar', publishing: 'Publicando', published: 'Publicada', failed: 'Carga fallida' };
async function loadReleases(append = false) {
  if (!active || releaseLoading) return; releaseLoading = true; const run = generation; $('#refresh-releases').disabled = true; $('#more-releases').disabled = true;
  status($('#releases-status'), 'Cargando historial…');
  try {
    const result = await admin(`/releases${append && releaseCursor ? `?cursor=${releaseCursor}` : ''}`); if (!active || run !== generation) return;
    maxBytes = result.maxBytes; if (!append) $('#releases-list').replaceChildren();
    $('#current-release').textContent = result.currentReleaseId ? `Versión seleccionada: ${result.currentReleaseId.replace('android-', 'código ')}` : 'Todavía no hay una versión seleccionada.';
    for (const item of result.items) {
      const card = node('article', undefined, 'clay-card release-item'); const current = item.id === result.currentReleaseId;
      const heading = node('div', undefined, 'admin-toolbar'); heading.append(node('h3', `MilpaGrow ${item.version}`), node('span', current ? 'Publicada y seleccionada' : releaseLabels[item.status] || item.status, 'state-badge')); card.append(heading);
      card.append(node('p', `Código ${item.versionCode} · ${item.sizeBytes ? formatSize(item.sizeBytes) : 'APK pendiente'} · Android ${item.minAndroid}+`), node('p', item.notes, 'release-description'));
      if (item.error) card.append(node('p', item.error, 'form-status error-text'));
      if (['uploaded', 'published'].includes(item.status) && !current) {
        const publish = node('button', item.status === 'published' ? 'Seleccionar esta versión' : 'Publicar en GitHub', 'button');
        publish.addEventListener('click', async () => { publish.disabled = true; status($('#releases-status'), 'Confirmando la publicación…'); try { await admin(`/releases/${item.id}/publish`, { method: 'POST' }); await loadReleases(); status($('#releases-status'), 'Versión publicada y seleccionada. Actualiza el archivo del servicio de descarga protegida para entregar esta versión en la web.'); } catch (error) { if (active) status($('#releases-status'), error.message, true); } finally { publish.disabled = false; } }); card.append(publish);
      }
      if (['draft', 'failed'].includes(item.status) || (item.status === 'uploading' && item.leaseUntil < Date.now())) {
        const label = node('label', 'Seleccionar APK para reintentar'); const file = node('input'); file.type = 'file'; file.accept = '.apk'; label.append(file); const retry = node('button', 'Reintentar carga', 'button button-outline');
        retry.addEventListener('click', async () => { if (uploading) return; try { validFile(file.files[0]); uploading = true; retry.disabled = true; await upload(item.id, file.files[0]); status($('#upload-status'), 'Carga completa en GitHub.'); if (uploadId === item.id) { uploadId = undefined; $('#release-form').reset(); for (const name of ['version', 'versionCode', 'minAndroid', 'notes']) $('#release-form').elements[name].disabled = false; } await loadReleases(); } catch (error) { if (active) status($('#releases-status'), error.message, true); } finally { uploading = false; retry.disabled = false; } }); card.append(label, retry);
      }
      if (item.status === 'publishing' && item.leaseUntil < Date.now()) {
        const recover = node('button', 'Reintentar publicación', 'button'); recover.addEventListener('click', async () => { recover.disabled = true; try { await admin(`/releases/${item.id}/publish`, { method: 'POST' }); await loadReleases(); } catch (error) { if (active) status($('#releases-status'), error.message, true); } finally { recover.disabled = false; } }); card.append(recover);
      }
      $('#releases-list').append(card);
    }
    releaseCursor = result.nextCursor; $('#more-releases').hidden = !releaseCursor;
    status($('#releases-status'), result.items.length ? '' : 'Todavía no hay instaladores. Sube el primer APK para comenzar.');
  } catch (error) { if (active) status($('#releases-status'), `${error.message} Puedes volver a intentar con Actualizar historial.`, true); }
  finally { releaseLoading = false; $('#refresh-releases').disabled = false; $('#more-releases').disabled = false; }
}
$('#refresh-releases').addEventListener('click', () => loadReleases()); $('#more-releases').addEventListener('click', () => loadReleases(true));
