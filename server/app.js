import express from 'express';
import cors from 'cors';
import { pipeline } from 'node:stream/promises';
import { AuthError } from './errors.js';
import { apkSource } from './apk.js';

export function createApp(service, { origins, trustProxyHops = 0, openApk = apkSource() }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', trustProxyHops);
  app.use((req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
    next();
  });
  app.get('/health', (req, res) => res.json({ success: true }));
  app.use('/api/registration', (req, res, next) => {
    const origin = req.get('origin');
    if (origin && !origins.includes(origin)) return next(new AuthError(403, 'ORIGIN_DENIED', 'Este sitio no tiene acceso al servicio de registro.'));
    next();
  }, cors({ origin: origins, methods: ['GET', 'POST'], allowedHeaders: ['Content-Type', 'Authorization'] }), express.json({ limit: '8kb' }));
  const route = (action, handler) => async (req, res, next) => {
    try { await service.rateLimit(req.ip, action); res.json({ success: true, data: await handler(req) }); }
    catch (error) { next(error); }
  };
  app.post('/api/registration/start', route('start', req => service.start(req.body)));
  app.post('/api/registration/resend', route('code', req => service.resend(req.body?.challenge)));
  app.post('/api/registration/confirm', route('code', req => service.confirm(req.body?.challenge, req.body?.code)));
  const bearer = req => {
    const header = req.get('authorization') || '';
    if (!header.startsWith('Bearer ')) throw new AuthError(401, 'AUTH_REQUIRED', 'Inicia sesión para continuar.');
    return header.slice(7);
  };
  app.get('/api/registration/session', route('session', req => service.session(bearer(req))));
  app.post('/api/registration/download-grant', route('session', req => service.grant(bearer(req))));
  app.get('/api/registration/users', route('session', req => service.registeredUsers(bearer(req), req.query.cursor)));
  app.get('/api/registration/download/:grant', async (req, res, next) => {
    let apk, event, completed = false;
    try {
      if (req.method !== 'GET') throw new AuthError(405, 'METHOD_NOT_ALLOWED', 'Usa el botón de descarga para obtener el archivo.');
      await service.rateLimit(req.ip, 'transfer');
      await service.checkDownload(req.params.grant);
      apk = await openApk();
      if (req.destroyed || res.destroyed) return;
      event = await service.beginDownload(req.params.grant, apk);
      res.set({ 'Content-Type': 'application/vnd.android.package-archive', 'Content-Disposition': 'attachment; filename="MilpaGrow.apk"' });
      if (apk.sizeBytes !== null) res.set('Content-Length', String(apk.sizeBytes));
      await pipeline(apk.stream, res);
      completed = true;
    } catch (error) {
      if (!res.destroyed) next(error);
    } finally {
      apk?.close();
      if (event) await service.finishDownload(event, completed).catch(() => console.error('No se pudo actualizar el estado de la descarga.'));
    }
  });
  app.use((req, res) => res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Ruta no disponible.' } }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.type === 'entity.parse.failed') error = new AuthError(400, 'INVALID_JSON', 'La solicitud no tiene un formato válido.');
    if (error.type === 'entity.too.large') error = new AuthError(413, 'BODY_TOO_LARGE', 'La solicitud es demasiado grande.');
    // No registra cuerpos, contraseñas, códigos, credenciales ni tokens.
    if (!(error instanceof AuthError)) console.error('Falló el registro web:', error.code || error.name || 'UNKNOWN');
    if (req.path.startsWith('/api/registration/download/') && req.get('accept')?.includes('text/html')) {
      const escape = value => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
      const message = error instanceof AuthError ? error.message : 'No se pudo entregar el instalador. Vuelve a intentar más tarde.';
      res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'");
      return res.status(error instanceof AuthError ? error.status : 500).type('html').send(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Descarga · MilpaGrow</title><style>body{font:16px system-ui;background:#f5f3ee;color:#143c25;max-width:480px;margin:15vh auto;padding:24px}a{display:inline-block;margin-top:20px;color:inherit}</style></head><body><h1>No se pudo descargar MilpaGrow</h1><p>${escape(message)}</p><a href="${escape(new URL('/acceso.html', origins[0]).href)}">Volver al acceso de descarga</a></body></html>`);
    }
    res.status(error instanceof AuthError ? error.status : 500).json({ success: false, error: {
      code: error instanceof AuthError ? error.code : 'REGISTRATION_UNAVAILABLE',
      message: error instanceof AuthError ? error.message : 'No se pudo completar el registro. Inténtalo más tarde o continúa desde Iniciar sesión.',
    } });
  });
  return app;
}
