import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';

export const registrationEnvPath = fileURLToPath(new URL('.env', import.meta.url));

export function loadRegistrationEnvironment({ env = process.env, envPath = registrationEnvPath } = {}) {
  // La configuración privada está junto al servidor, independientemente de
  // dónde se ejecute Node. Las variables de Render conservan su prioridad.
  config({ path: envPath, processEnv: env, quiet: true });
  return env;
}

export function allowedOrigins(env = process.env) {
  const values = (env.WEBSITE_ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
  if (!values.length) {
    throw new Error('Falta WEBSITE_ALLOWED_ORIGINS en el servicio de registro. Configúrala con https://milpagrow-web.onrender.com; en local se carga desde server/.env.');
  }
  return [...new Set(values.map(value => {
    let url;
    try { url = new URL(value); } catch {}
    if (!url || !['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
      throw new Error('WEBSITE_ALLOWED_ORIGINS debe contener direcciones como https://milpagrow-web.onrender.com, separadas por comas, sin rutas, parámetros ni credenciales.');
    }
    // El navegador envía Origin sin barra final y con el host normalizado.
    return url.origin;
  }))];
}
