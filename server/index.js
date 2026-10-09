import 'dotenv/config';
import { firebaseServices } from './firebase.js';
import { registrationMailer } from './mail.js';
import { registrationService } from './registration.js';
import { createApp } from './app.js';

const origins = (process.env.WEBSITE_ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
if (!origins.length || origins.some(value => { try { return new URL(value).origin !== value; } catch { return true; } })) {
  throw new Error('Configura WEBSITE_ALLOWED_ORIGINS con los orígenes exactos de MilpaWeb, separados por comas.');
}
const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0 || trustProxyHops > 2) throw new Error('TRUST_PROXY_HOPS debe ser 0, 1 o 2.');
const service = registrationService({ ...firebaseServices(), secret: process.env.WEBSITE_REGISTRATION_SECRET, sendCode: registrationMailer() });
const app = createApp(service, { origins, trustProxyHops });
app.listen(Number(process.env.PORT || 3001), '0.0.0.0', () => console.log('Servicio de registro de MilpaWeb iniciado.'));
