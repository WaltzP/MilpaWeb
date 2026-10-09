import { loadRegistrationEnvironment, allowedOrigins } from './environment.js';
import { firebaseServices } from './firebase.js';
import { registrationMailer } from './mail.js';
import { registrationService } from './registration.js';
import { createApp } from './app.js';

loadRegistrationEnvironment();
const origins = allowedOrigins();
const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0 || trustProxyHops > 2) throw new Error('TRUST_PROXY_HOPS debe ser 0, 1 o 2.');
const service = registrationService({ ...firebaseServices(), secret: process.env.WEBSITE_REGISTRATION_SECRET, sendCode: registrationMailer() });
const app = createApp(service, { origins, trustProxyHops });
app.listen(Number(process.env.PORT || 3001), '0.0.0.0', () => console.log('Servicio de registro de MilpaWeb iniciado.'));
