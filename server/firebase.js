import { applicationDefault, cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export function firebaseServices(env = process.env) {
  const projectId = env.FIREBASE_PROJECT_ID?.trim();
  if (!projectId || projectId !== env.MILPAGROW_FIREBASE_PROJECT_ID?.trim()) {
    throw new Error('FIREBASE_PROJECT_ID y MILPAGROW_FIREBASE_PROJECT_ID deben ser el mismo proyecto de MilpaGrow.');
  }
  let account;
  if (env.FIREBASE_SERVICE_ACCOUNT_JSON) account = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
  else if (env.FIREBASE_SERVICE_ACCOUNT_BASE64) account = JSON.parse(Buffer.from(env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8'));
  if (account && account.project_id !== projectId) throw new Error('Las credenciales Firebase Admin deben pertenecer al proyecto de MilpaGrow.');
  const emulated = env.FIREBASE_AUTH_EMULATOR_HOST && env.FIRESTORE_EMULATOR_HOST;
  if (env.NODE_ENV === 'production' && (env.FIREBASE_AUTH_EMULATOR_HOST || env.FIRESTORE_EMULATOR_HOST)) {
    throw new Error('No se permiten emuladores en producción.');
  }
  const app = initializeApp({ projectId, ...(emulated ? {} : { credential: account ? cert(account) : applicationDefault() }) }, 'milpaweb-registration');
  return { auth: getAuth(app), db: getFirestore(app) };
}
