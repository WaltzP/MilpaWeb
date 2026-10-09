export class AuthError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
export const invalidCode = () => new AuthError(400, 'INVALID_REGISTRATION_CODE', 'El código no es válido o venció. Solicita uno nuevo.');
export const limited = () => new AuthError(429, 'REGISTRATION_LIMIT', 'Demasiados intentos o envíos. Espera antes de intentarlo de nuevo.');
