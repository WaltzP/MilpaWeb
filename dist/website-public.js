import { request, status, formatDate, formatSize } from './website-api.js';
import { publishedAndroidRelease } from './android-release.js';
const link = document.querySelector('.download-link');
const releaseStatus = document.querySelector('#release-status');
const retry = document.querySelector('#release-retry');
let loadingRelease = false;
let availableRelease;
function disableDownload() {
  availableRelease = undefined;
  link.removeAttribute('href'); link.setAttribute('aria-disabled', 'true');
  document.querySelector('#apk-details').hidden = true;
}
function showRelease(release) {
  let url;
  try { url = new URL(release.downloadUrl); } catch { throw new Error('Datos inválidos'); }
  if (url.protocol !== 'https:' || url.hostname !== 'github.com' || !url.pathname.includes('/releases/download/') || url.username || url.password || !Number.isFinite(release.sizeBytes) || release.sizeBytes <= 0 || !Number.isFinite(Date.parse(release.publishedAt))) throw new Error('Datos inválidos');
  document.querySelector('#apk-version').textContent = release.version;
  document.querySelector('#apk-date').textContent = formatDate(release.publishedAt);
  document.querySelector('#apk-size').textContent = formatSize(release.sizeBytes);
  document.querySelector('#apk-android').textContent = `Android ${release.minAndroid} o superior`;
  document.querySelector('#apk-notes').textContent = release.notes;
  document.querySelector('#apk-details').hidden = false;
  link.href = url.href; link.removeAttribute('aria-disabled');
  availableRelease = release;
}
async function loadRelease() {
  if (loadingRelease) return;
  loadingRelease = true;
  status(releaseStatus, 'Comprobando la versión más reciente…'); retry.hidden = true;
  try {
    const release = await request('/website/release');
    if (!release) { disableDownload(); status(releaseStatus, 'El instalador estará disponible cuando se publique la primera versión.'); return; }
    showRelease(release);
    status(releaseStatus, 'Versión publicada y lista para descargar.');
  } catch (error) {
    try {
      if (error.message === 'Datos inválidos') throw error;
      showRelease(availableRelease || publishedAndroidRelease);
      status(releaseStatus, `MilpaGrow ${availableRelease.version} está disponible para descargar.`);
    } catch {
      disableDownload();
      status(releaseStatus, 'No se pudo confirmar la versión publicada. Vuelve a intentar.', true);
    }
    retry.hidden = false;
  } finally { loadingRelease = false; }
}
link.addEventListener('click', event => { if (link.getAttribute('aria-disabled') === 'true') event.preventDefault(); });
retry.addEventListener('click', loadRelease);
try { showRelease(publishedAndroidRelease); } catch { disableDownload(); }
loadRelease();
document.addEventListener('visibilitychange', () => { if (!document.hidden) loadRelease(); });
setInterval(() => { if (!document.hidden) loadRelease(); }, 300000);

const form = document.querySelector('#demo-form');
const button = form.querySelector('[type=submit]');
const feedback = document.querySelector('#demo-status');
let challenge, challengeAt = 0, challengePromise, submission, sending = false;
function refreshChallenge() {
  if (challengePromise) return challengePromise;
  challengePromise = request('/website/demo-challenge').then(result => { challenge = result; challengeAt = Date.now(); }).finally(() => { challengePromise = undefined; });
  return challengePromise;
}
refreshChallenge().catch(() => {});
form.addEventListener('input', event => { event.target.setCustomValidity?.(''); });
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (sending) return;
  const values = Object.fromEntries(new FormData(form));
  const fields = ['name', 'email', 'phone', 'message'];
  fields.forEach(key => { values[key] = values[key].trim(); });
  const errors = {
    name: values.name.length < 2 ? 'Escribe tu nombre (al menos 2 caracteres).' : '',
    email: !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email) ? 'Introduce un correo válido.' : '',
    phone: values.phone && !/^\+?[\d\s().-]{7,30}$/.test(values.phone) ? 'Introduce un teléfono válido.' : '',
    message: values.message.length < 10 ? 'Cuéntanos un poco más (al menos 10 caracteres).' : '',
  };
  Object.entries(errors).forEach(([key, message]) => form.elements[key].setCustomValidity(message));
  if (!form.reportValidity()) return;
  const fingerprint = JSON.stringify(values);
  if (submission?.fingerprint !== fingerprint) submission = { fingerprint, key: crypto.randomUUID() };
  sending = true; button.disabled = true; form.setAttribute('aria-busy', 'true');
  status(feedback, 'Enviando tu solicitud…');
  try {
    if (!challenge || Date.now() - challengeAt > 3500000) await refreshChallenge();
    const wait = Math.max(0, challenge.minWaitMs - (Date.now() - challengeAt) + 100);
    if (wait) await new Promise(resolve => setTimeout(resolve, wait));
    await request('/website/demo-requests', { method: 'POST', body: { ...values, challenge: challenge.challenge }, headers: { 'Idempotency-Key': submission.key } });
    form.reset(); submission = undefined; challenge = undefined;
    status(feedback, '¡Solicitud recibida! El equipo de NEREON te contactará al correo que nos compartiste para coordinar la demostración.');
    feedback.focus(); refreshChallenge().catch(() => {});
  } catch (error) {
    if (error.code === 'CHALLENGE_EXPIRED') { challenge = undefined; refreshChallenge().catch(() => {}); }
    if (error.code === 'IDEMPOTENCY_CONFLICT') submission = undefined;
    status(feedback, `${error.message} Tus datos siguen en el formulario.`, true);
  } finally { sending = false; button.disabled = false; form.removeAttribute('aria-busy'); }
});
