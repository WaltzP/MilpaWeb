import { ApiError } from './website-api.js';
const config = window.MILPAGROW_CONFIG || {};

export function registrationDownloadUrl(grant) {
  if (!config.registrationApiUrl || !/^[A-Za-z0-9_-]{43}$/.test(grant)) throw new ApiError('El servidor no autorizó la descarga. Vuelve a intentar.', 'DOWNLOAD_GRANT_INVALID');
  return `${config.registrationApiUrl.replace(/\/$/, '')}/download/${grant}`;
}

export async function registrationRequest(path, { body, token, signal } = {}) {
  if (!config.registrationApiUrl) throw new ApiError('El registro web aún no está disponible. Inténtalo más tarde.', 'REGISTRATION_CONFIG');
  let response;
  try {
    response = await fetch(`${config.registrationApiUrl.replace(/\/$/, '')}${path}`, {
      method: body === undefined ? 'GET' : 'POST', credentials: 'omit', cache: 'no-store',
      headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: signal || AbortSignal.timeout(30000),
    });
  } catch { throw new ApiError('No se pudo conectar. Comprueba tu conexión y vuelve a intentar.'); }
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success) throw new ApiError(result?.error?.message || 'No fue posible completar la operación. Vuelve a intentar.', result?.error?.code, response.status);
  return result.data;
}
