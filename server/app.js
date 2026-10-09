import express from 'express';
import cors from 'cors';
import { AuthError } from './errors.js';

export function createApp(service, { origins, trustProxyHops = 0 }) {
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
  app.get('/api/registration/session', route('session', req => {
    const header = req.get('authorization') || '';
    if (!header.startsWith('Bearer ')) throw new AuthError(401, 'AUTH_REQUIRED', 'Inicia sesión para continuar.');
    return service.session(header.slice(7));
  }));
  app.use((req, res) => res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Ruta no disponible.' } }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.type === 'entity.parse.failed') error = new AuthError(400, 'INVALID_JSON', 'La solicitud no tiene un formato válido.');
    if (error.type === 'entity.too.large') error = new AuthError(413, 'BODY_TOO_LARGE', 'La solicitud es demasiado grande.');
    // No registra cuerpos, contraseñas, códigos, credenciales ni tokens.
    if (!(error instanceof AuthError)) console.error('Falló el registro web:', error.code || error.name || 'UNKNOWN');
    res.status(error instanceof AuthError ? error.status : 500).json({ success: false, error: {
      code: error instanceof AuthError ? error.code : 'REGISTRATION_UNAVAILABLE',
      message: error instanceof AuthError ? error.message : 'No se pudo completar el registro. Inténtalo más tarde o continúa desde Iniciar sesión.',
    } });
  });
  return app;
}
