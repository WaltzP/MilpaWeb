import { request, status } from './website-api.js';

const form = document.querySelector('#demo-form');
const button = form.querySelector('[type=submit]');
const feedback = document.querySelector('#demo-status');
let challenge, challengeAt = 0, challengePromise, submission, sending = false;
function refreshChallenge() {
  if (challengePromise) return challengePromise;
  challengePromise = request('/website/demo-challenge').then(result => { challenge = result; challengeAt = Date.now(); }).finally(() => { challengePromise = undefined; });
  return challengePromise;
}
form.addEventListener('focusin', () => refreshChallenge().catch(() => {}), { once: true });
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
