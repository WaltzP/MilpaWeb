import { AuthError } from './errors.js';

export function registrationMailer(env = process.env, transport = fetch) {
  if (!env.BREVO_API_KEY?.trim() || !env.BREVO_FROM_EMAIL?.trim()) throw new Error('Configura BREVO_API_KEY y BREVO_FROM_EMAIL en el servidor de registro.');
  return async (to, code) => {
    let response;
    try {
      response = await transport('https://api.brevo.com/v3/smtp/email', {
        method: 'POST', signal: AbortSignal.timeout(15000),
        headers: { 'api-key': env.BREVO_API_KEY.trim(), 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          sender: { name: env.BREVO_FROM_NAME || 'MilpaGrow', email: env.BREVO_FROM_EMAIL.trim() },
          to: [{ email: to }], subject: 'Verifica tu correo de MilpaGrow', tags: ['milpaweb-registration'],
          textContent: `Confirma tu cuenta de MilpaGrow con este código: ${code}\n\nVence en 10 minutos. No lo compartas. Tu cuenta también funciona en la app.`,
          htmlContent: `<!doctype html><html lang="es"><body style="margin:0;padding:32px 16px;background:#f1f5ef;font-family:Arial,sans-serif;color:#20382d"><div style="max-width:480px;margin:auto;padding:32px;background:white;border-radius:20px"><p style="color:#28764d;font-weight:bold">MilpaGrow</p><h1 style="font-size:26px">Verifica tu correo electrónico</h1><p>Escribe este código en la web para confirmar tu cuenta.</p><p style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#28764d">${code}</p><p>El código vence en 10 minutos. No lo compartas con nadie.</p><p>Podrás usar el mismo correo y contraseña en la app y completar allí los datos de tu perfil y tu finca.</p></div></body></html>`,
        }),
      });
    } catch { throw new AuthError(502, 'MAIL_NETWORK', 'No se pudo conectar con el servicio de correo.'); }
    const result = await response.json().catch(() => ({}));
    if (!response.ok || typeof result.messageId !== 'string' || !result.messageId.trim()) {
      throw new AuthError(503, 'MAIL_SEND', 'No se pudo enviar el código. Inténtalo más tarde. Si tu cuenta ya se creó, puedes continuar desde Iniciar sesión.');
    }
  };
}
