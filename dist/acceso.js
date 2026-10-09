import { request, ApiError, status } from './website-api.js';
import { registrationRequest } from './registration-api.js';
import { signIn, signOut, token } from './firebase-session.js';

const $ = selector => document.querySelector(selector);
const feedback = $('#access-status');
let generation = 0, busy = false, challenge, challengeType, resendAt = 0, timer, pendingCustomToken, sessionEstablished = false;
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $('#access-theme').textContent = theme === 'dark' ? 'Tema claro' : 'Tema oscuro';
  document.querySelector('meta[name=theme-color]').content = theme === 'dark' ? '#0E2818' : '#F5F3EE';
}
try { const theme = localStorage.getItem('milpagrow-theme'); if (['light', 'dark'].includes(theme)) applyTheme(theme); } catch {}
$('#access-theme').addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(theme); try { localStorage.setItem('milpagrow-theme', theme); } catch {}
});
function show(view) {
  for (const name of ['login', 'register', 'code', 'recovery', 'ready']) $(`#access-${name}`).hidden = name !== view;
  $('#access-tabs').hidden = !['login', 'register'].includes(view);
  $('#choose-login').setAttribute('aria-pressed', String(view === 'login'));
  $('#choose-register').setAttribute('aria-pressed', String(view === 'register'));
}
function reset(view = 'login') {
  generation++; busy = false; challenge = undefined; pendingCustomToken = undefined; sessionEstablished = false; signOut(); clearInterval(timer);
  for (const form of document.querySelectorAll('.access-form')) {
    form.reset(); form.removeAttribute('aria-busy');
    for (const field of form.querySelectorAll('input')) field.setCustomValidity('');
    form.querySelector('[type=submit]').disabled = false;
  }
  for (const button of document.querySelectorAll('[data-password]')) {
    $(`#${button.dataset.password}`).type = 'password'; button.textContent = 'Mostrar';
    button.setAttribute('aria-label', button.dataset.password.includes('confirm') ? 'Mostrar confirmación de contraseña' : 'Mostrar contraseña');
  }
  $('#access-email').textContent = ''; status(feedback, ''); show(view);
}
for (const [id, view] of [['choose-login', 'login'], ['choose-register', 'register'], ['access-restart', 'login'], ['recovery-back', 'login'], ['access-logout', 'login']]) {
  $(`#${id}`).addEventListener('click', () => { reset(view); $(`#access-${view} input`).focus(); });
}
$('#choose-recovery').addEventListener('click', () => {
  const email = $('#login-email').value; reset('recovery'); $('#recovery-email').value = email; $('#recovery-email').focus();
});
document.querySelectorAll('[data-password]').forEach(button => button.addEventListener('click', () => {
  const input = $(`#${button.dataset.password}`); input.type = input.type === 'password' ? 'text' : 'password';
  button.textContent = input.type === 'password' ? 'Mostrar' : 'Ocultar';
  button.setAttribute('aria-label', `${button.textContent} ${input.id.includes('confirm') ? 'confirmación de contraseña' : 'contraseña'}`);
}));
for (const form of document.querySelectorAll('.access-form')) form.addEventListener('input', () => {
  for (const field of form.querySelectorAll('input')) field.setCustomValidity('');
});
function emailValid(value) {
  const parts = value.trim().split('@');
  return value.trim().length <= 254 && parts.length === 2 && parts[0].length <= 64 &&
    !parts[0].startsWith('.') && !parts[0].endsWith('.') && !parts[0].includes('..') &&
    /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(parts[0]) &&
    /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(parts[1]) && parts[1].split('.').every(label => label.length <= 63);
}
function validate(form, registering = false) {
  const email = form.elements.email;
  if (email) email.setCustomValidity(emailValid(email.value) ? '' : 'Ingresa un correo electrónico válido.');
  if (registering) {
    const password = form.elements.password;
    password.setCustomValidity(password.value.length >= 8 && password.value.length <= 128 && /[A-Z]/.test(password.value) && /[0-9]/.test(password.value) ? '' : 'La contraseña debe tener entre 8 y 128 caracteres, una mayúscula y un número.');
    form.elements.confirmPassword.setCustomValidity(password.value === form.elements.confirmPassword.value ? '' : 'Las contraseñas no coinciden.');
  }
  return form.reportValidity();
}
function cooldown() {
  const remaining = Math.max(0, Math.ceil((resendAt - Date.now()) / 1000));
  $('#access-resend').disabled = Boolean(remaining || busy);
  $('#access-resend').textContent = remaining ? `Reenviar en ${remaining} s` : 'Reenviar código';
}
function setChallenge(data, type) {
  if (!data?.challenge || !data?.email) throw new ApiError('El servidor no confirmó el envío del código. Vuelve a intentar.');
  challenge = data.challenge; challengeType = type; pendingCustomToken = undefined; sessionEstablished = false;
  resendAt = Date.now() + (Number(data.resendAfterSeconds) || 60) * 1000;
  $('#code-description').textContent = `${type === 'registration' ? 'Confirma tu registro' : 'Confirma tu inicio de sesión'} con el código que enviamos a ${data.email}.`;
  $('#access-code').reset(); show('code'); clearInterval(timer); cooldown(); timer = setInterval(cooldown, 1000);
  $('#access-code-input').focus();
}
async function operation(form, message, action) {
  if (busy) return;
  const run = generation;
  busy = true; const button = form.querySelector('[type=submit]'); if (button) button.disabled = true;
  form.setAttribute('aria-busy', 'true'); cooldown(); status(feedback, message);
  try { await action(run); }
  catch (error) {
    if (run !== generation) return;
    const hint = ['MAIL_SEND', 'MAIL_NETWORK', 'NETWORK_ERROR', 'REGISTRATION_UNAVAILABLE'].includes(error.code) && form.id === 'access-register' ? ' Si tu cuenta ya se creó, continúa desde Iniciar sesión con el mismo correo y contraseña.' : '';
    status(feedback, `${error.message}${hint}`, true);
  } finally {
    if (run === generation) { busy = false; if (button) button.disabled = false; form.removeAttribute('aria-busy'); cooldown(); }
  }
}
$('#access-login').addEventListener('submit', event => {
  event.preventDefault(); const form = event.currentTarget; if (!validate(form)) return;
  operation(form, 'Comprobando tu cuenta y enviando el código…', async run => {
    const data = await request('/auth/login', { method: 'POST', body: { email: form.elements.email.value.trim(), password: form.elements.password.value } });
    if (run !== generation) return;
    form.elements.password.value = ''; setChallenge(data, 'login'); status(feedback, 'Código enviado. Escribe los seis dígitos que recibiste en tu correo.');
  });
});
$('#access-register').addEventListener('submit', event => {
  event.preventDefault(); const form = event.currentTarget; if (!validate(form, true)) return;
  operation(form, 'Creando tu cuenta y enviando el código…', async run => {
    const data = await registrationRequest('/start', { body: { email: form.elements.email.value.trim(), password: form.elements.password.value, confirmPassword: form.elements.confirmPassword.value } });
    if (run !== generation) return;
    form.elements.password.value = ''; form.elements.confirmPassword.value = ''; setChallenge(data, 'registration'); status(feedback, 'Cuenta creada. Confirma el código de tu correo para continuar.');
  });
});
$('#access-code').addEventListener('submit', event => {
  event.preventDefault(); const form = event.currentTarget; if (!form.reportValidity()) return;
  operation(form, 'Verificando tu código…', async run => {
    // Si la confirmación ya terminó y falló sólo el canje/consulta, se puede
    // reintentar sin consumir por segunda vez el código de un solo uso.
    if (!pendingCustomToken) {
      const result = challengeType === 'registration'
        ? await registrationRequest('/confirm', { body: { challenge, code: form.elements.code.value } })
        : await request('/auth/login-code/confirm', { method: 'POST', body: { challenge, code: form.elements.code.value } });
      if (run !== generation) return;
      pendingCustomToken = result.customToken;
    }
    if (!pendingCustomToken) throw new ApiError('El servidor no confirmó tu código. Vuelve a intentar.');
    if (!sessionEstablished) {
      await signIn(pendingCustomToken, () => run === generation);
      if (run === generation) sessionEstablished = true;
    }
    if (run !== generation) return;
    const account = await registrationRequest('/session', { token: await token() });
    if (run !== generation) return;
    pendingCustomToken = undefined; challenge = undefined; clearInterval(timer);
    form.reset(); $('#access-email').textContent = account.email; show('ready');
    status(feedback, 'Correo verificado. Ya puedes descargar MilpaGrow.'); $('#verified-download').focus();
  });
});
$('#access-resend').addEventListener('click', () => {
  if (busy || !challenge || Date.now() < resendAt) return;
  operation($('#access-code'), 'Enviando un código nuevo…', async run => {
    const data = challengeType === 'registration'
      ? await registrationRequest('/resend', { body: { challenge } })
      : await request('/auth/login-code/resend', { method: 'POST', body: { challenge } });
    if (run !== generation) return;
    pendingCustomToken = undefined; setChallenge(data, challengeType); status(feedback, 'Código reenviado. Usa el último código que recibiste.');
  });
});
$('#access-recovery').addEventListener('submit', event => {
  event.preventDefault(); const form = event.currentTarget; if (!validate(form)) return;
  operation(form, 'Solicitando el enlace de recuperación…', async run => {
    await request('/auth/password-recovery', { method: 'POST', body: { email: form.elements.email.value.trim() } });
    if (run !== generation) return;
    status(feedback, 'Si existe una cuenta con ese correo, recibirás un enlace para cambiar tu contraseña. Revisa también la carpeta de spam.');
  });
});
$('#verified-download').addEventListener('click', () => {
  status(feedback, 'Tu navegador abrirá el enlace de descarga. Cuando termine, abre MilpaGrow.apk desde las descargas de tu Android.');
});
window.addEventListener('pagehide', () => { generation++; clearInterval(timer); pendingCustomToken = undefined; signOut(); });
window.addEventListener('pageshow', event => { if (event.persisted) reset(); });
