import { AuthError } from './errors.js';

// Mismas reglas que AuthValidations de MilpaGrow, sin cambiar el proyecto Flutter.
export function email(value) {
  const result = typeof value === 'string' ? value.trim().toLowerCase() : '';
  const parts = result.split('@');
  if (!result || result.length > 254 || parts.length !== 2 || parts[0].length > 64 ||
      parts[0].startsWith('.') || parts[0].endsWith('.') || parts[0].includes('..') ||
      !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(parts[0]) ||
      !/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(parts[1]) ||
      parts[1].split('.').some(label => label.length > 63)) {
    throw new AuthError(400, 'INVALID_EMAIL', 'El correo electrónico no tiene un formato válido.');
  }
  return result;
}
export function password(value, confirmation) {
  if (typeof value !== 'string' || value.length < 8 || value.length > 128 || !/[A-Z]/.test(value) || !/[0-9]/.test(value)) {
    throw new AuthError(400, 'WEAK_PASSWORD', 'La contraseña debe tener entre 8 y 128 caracteres, una mayúscula y un número.');
  }
  if (value !== confirmation) throw new AuthError(400, 'PASSWORD_MISMATCH', 'Las contraseñas no coinciden.');
  return value;
}
