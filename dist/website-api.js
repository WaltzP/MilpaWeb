const config = window.MILPAGROW_CONFIG || {};
export class ApiError extends Error {
  constructor(message, code = 'NETWORK_ERROR', status = 0) { super(message); this.code = code; this.status = status; }
}
export function apiUrl(path) {
  if (!config.apiUrl) throw new ApiError('El servicio todavía no está disponible. Inténtalo más tarde.', 'CONFIG_REQUIRED');
  return `${config.apiUrl.replace(/\/$/, '')}${path}`;
}
export async function request(path, { method = 'GET', body, headers = {}, token, signal } = {}) {
  let response;
  try {
    response = await fetch(apiUrl(path), {
      method, cache: 'no-store', credentials: 'omit',
      headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: signal || AbortSignal.timeout(30000),
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('No se pudo conectar. Comprueba tu conexión y vuelve a intentar.');
  }
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success) throw new ApiError(result?.error?.message || 'No fue posible completar la operación. Vuelve a intentar.', result?.error?.code, response.status);
  return result.data;
}
export function status(element, message, error = false) {
  element.textContent = message;
  element.dataset.state = error ? 'error' : 'success';
}
export function formatDate(value) {
  return new Intl.DateTimeFormat('es-NI', { dateStyle: 'medium' }).format(new Date(value));
}
export function formatSize(bytes) { return `${(bytes / (1024 * 1024)).toLocaleString('es-NI', { maximumFractionDigits: 1 })} MB`; }
// Todos los datos remotos se insertan como texto, nunca como HTML.
export function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}
