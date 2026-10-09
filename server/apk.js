import { open } from 'node:fs/promises';
import { AuthError } from './errors.js';

const unavailable = () => new AuthError(503, 'APK_UNAVAILABLE', 'El instalador no está disponible en este momento. Intenta descargarlo más tarde.');

// El archivo se aloja fuera del sitio estático. Ninguna URL de origen ni
// credencial se entrega al navegador. No existe una descarga pública de reserva.
export function apkSource(env = process.env, transport = fetch) {
  const file = env.WEBSITE_APK_PATH?.trim(), source = env.WEBSITE_APK_URL?.trim();
  if (file && source) throw new Error('Configura sólo WEBSITE_APK_PATH o WEBSITE_APK_URL.');
  if (source) {
    let url;
    try { url = new URL(source); } catch {}
    if (!url || url.protocol !== 'https:' || url.username || url.password || url.hash) throw new Error('WEBSITE_APK_URL debe ser una URL HTTPS sin credenciales.');
  }
  const version = env.WEBSITE_APK_VERSION?.trim() || 'current';
  return async () => {
    if (file) {
      let handle;
      try {
        handle = await open(file, 'r');
        const stat = await handle.stat();
        if (!stat.isFile() || !stat.size) throw unavailable();
        const stream = handle.createReadStream();
        return { stream, sizeBytes: stat.size, version, close: () => stream.destroy() };
      } catch {
        await handle?.close().catch(() => {});
        throw unavailable();
      }
    }
    if (!source) throw unavailable();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15 * 60 * 1000);
    const headerTimer = setTimeout(() => controller.abort(), 30000);
    let response;
    try {
      response = await transport(source, {
        headers: { Accept: 'application/octet-stream', 'Accept-Encoding': 'identity', ...(env.WEBSITE_APK_AUTH_TOKEN ? { Authorization: `Bearer ${env.WEBSITE_APK_AUTH_TOKEN}` } : {}) },
        signal: controller.signal,
      });
      clearTimeout(headerTimer);
      if (response.url && new URL(response.url).protocol !== 'https:') throw unavailable();
      const type = response.headers.get('content-type')?.split(';')[0];
      if (!response.ok || !response.body || !['application/vnd.android.package-archive', 'application/octet-stream', 'application/zip'].includes(type)) throw unavailable();
      const size = response.headers.get('content-length');
      const encoding = response.headers.get('content-encoding');
      const sizeBytes = size === null || (encoding && encoding !== 'identity') ? null : Number(size);
      if (sizeBytes !== null && (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0)) throw unavailable();
      return { stream: response.body, sizeBytes, version, close: () => { clearTimeout(timer); controller.abort(); } };
    } catch {
      clearTimeout(headerTimer); clearTimeout(timer); controller.abort(); throw unavailable();
    }
  };
}
