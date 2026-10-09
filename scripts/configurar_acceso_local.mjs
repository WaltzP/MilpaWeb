import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import path from 'node:path';

// Reutiliza la configuración local de la app como lectura. Los dos archivos
// generados están ignorados por Git; nunca muestra secretos en la terminal.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'server/package.json'));
const { parse } = require('dotenv');
const app = process.argv[2] && path.resolve(process.argv[2]);
if (!app) throw new Error('Uso: node scripts/configurar_acceso_local.mjs /ruta/a/MilpaGrow');
const files = [path.join(root, '.env'), path.join(root, 'server/.env')];
if (files.some(existsSync)) throw new Error('Ya existe configuración local. Revísala manualmente; el script no la sobrescribe.');
const readEnv = file => existsSync(file) ? parse(readFileSync(file)) : {};
const env = { ...readEnv(path.join(app, 'server/.env')), ...readEnv(path.join(app, '.env')), ...process.env };
const publicFirebase = JSON.parse(readFileSync(path.join(app, 'android/app/google-services.json'), 'utf8'));
const project = publicFirebase.project_info.project_id;
const apiKey = env.FIREBASE_API_KEY || publicFirebase.client[0].api_key[0].current_key;
const credential = path.join(app, 'server/serviceKey.json');
const account = JSON.parse(readFileSync(credential, 'utf8'));
if (!project || account.project_id !== project) throw new Error('Los proyectos Firebase de la app y de la cuenta de servicio no coinciden.');
if (!env.BREVO_API_KEY || !env.BREVO_FROM_EMAIL) throw new Error('La configuración local de la app no contiene el remitente y la clave de Brevo.');
const publicValues = {
  MILPAGROW_API_URL: env.API_BASE_URL || 'https://milpagrow.onrender.com/api',
  MILPAGROW_FIREBASE_API_KEY: apiKey, MILPAGROW_FIREBASE_PROJECT_ID: project,
  MILPAGROW_REGISTRATION_API_URL: 'http://localhost:3001/api/registration',
};
const privateValues = {
  PORT: '3001', FIREBASE_PROJECT_ID: project, MILPAGROW_FIREBASE_PROJECT_ID: project,
  GOOGLE_APPLICATION_CREDENTIALS: credential, BREVO_API_KEY: env.BREVO_API_KEY,
  BREVO_FROM_EMAIL: env.BREVO_FROM_EMAIL, BREVO_FROM_NAME: env.BREVO_FROM_NAME || 'MilpaGrow',
  WEBSITE_REGISTRATION_SECRET: randomBytes(48).toString('base64url'),
  WEBSITE_ALLOWED_ORIGINS: 'http://127.0.0.1:4173,http://localhost:4173', TRUST_PROXY_HOPS: '0',
};
for (const [index, values] of [publicValues, privateValues].entries()) {
  const content = Object.entries(values).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join('\n') + '\n';
  writeFileSync(files[index], content, { mode: 0o600, flag: 'wx' });
}
console.log('Configuración local de MilpaWeb preparada con el mismo Firebase y correo de la app. MilpaGrow no se modificó.');
