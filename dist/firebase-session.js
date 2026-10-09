import { ApiError } from './website-api.js';
const config = window.MILPAGROW_CONFIG || {};
let session;
let refreshing;
async function firebase(endpoint, body, refresh = false) {
  if (!config.firebaseApiKey || !config.firebaseProjectId) throw new ApiError('Configura Firebase Authentication para habilitar el acceso.', 'AUTH_CONFIG');
  let response;
  try {
    response = await fetch(`${endpoint}?key=${encodeURIComponent(config.firebaseApiKey)}`, {
      method: 'POST', credentials: 'omit', headers: { 'Content-Type': refresh ? 'application/x-www-form-urlencoded' : 'application/json' },
      body: refresh ? new URLSearchParams(body) : JSON.stringify(body), signal: AbortSignal.timeout(20000),
    });
  } catch { throw new ApiError('No se pudo conectar con Firebase. Vuelve a intentar.'); }
  const result = await response.json().catch(() => null);
  if (!response.ok || !result) throw new ApiError('Tu sesión no es válida. Inicia sesión nuevamente.', 'INVALID_TOKEN', 401);
  const idToken = refresh ? result.id_token : result.idToken;
  const refreshToken = refresh ? result.refresh_token : result.refreshToken;
  const expiresIn = Number(refresh ? result.expires_in : result.expiresIn);
  if (!idToken || !refreshToken || !expiresIn) throw new ApiError('Firebase no confirmó la sesión.', 'INVALID_TOKEN', 401);
  // Verifica la coincidencia del proyecto. La firma se verifica siempre en la API.
  try {
    const claims = JSON.parse(atob(idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (claims.aud !== config.firebaseProjectId) throw new Error();
  } catch { throw new ApiError('El proyecto de Firebase no coincide con el de la API.', 'AUTH_CONFIG'); }
  return { idToken, refreshToken, expiresAt: Date.now() + expiresIn * 1000 };
}
export async function signIn(customToken, isCurrent = () => true) {
  const candidate = await firebase('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken', { token: customToken, returnSecureToken: true });
  if (isCurrent()) session = candidate;
}
export async function token() {
  if (!session) throw new ApiError('Inicia sesión para continuar.', 'AUTH_REQUIRED', 401);
  if (session.expiresAt < Date.now() + 60000) {
    const previous = session;
    if (!refreshing) refreshing = firebase('https://securetoken.googleapis.com/v1/token', { grant_type: 'refresh_token', refresh_token: previous.refreshToken }, true).then(value => { if (session === previous) session = value; }).finally(() => { refreshing = undefined; });
    await refreshing;
  }
  if (!session) throw new ApiError('Inicia sesión para continuar.', 'AUTH_REQUIRED', 401);
  return session.idToken;
}
export function signOut() { session = undefined; }
