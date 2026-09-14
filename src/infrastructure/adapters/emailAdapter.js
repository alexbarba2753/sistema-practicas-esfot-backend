import sgMail from '@sendgrid/mail';
import { ENV } from '../config/env.js';

if (ENV.SENDGRID_API_KEY && ENV.SENDGRID_API_KEY.startsWith('SG.')) {
  sgMail.setApiKey(ENV.SENDGRID_API_KEY);
}

export const emailAdapter = {
  async enviarCorreoRecuperacion(destinatario, token) {
    const enlace = `${ENV.CLIENT_URL}/reset-password?token=${token}`;
    const asunto = 'Recuperación de contraseña - Sistema de Prácticas ESFOT';
    const contenido = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
        <h2>Recuperación de Contraseña</h2>
        <p>Has solicitado restablecer tu contraseña en el Sistema de Prácticas de la ESFOT.</p>
        <p>Haz clic en el siguiente enlace para crear una nueva contraseña:</p>
        <p><a href="${enlace}" style="background-color: #003366; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Restablecer Contraseña</a></p>
        <p>Este enlace expirará en 1 hora.</p>
        <p>Si no solicitaste este cambio, puedes ignorar este correo.</p>
      </div>
    `;

    try {
      if (ENV.SENDGRID_API_KEY && ENV.SENDGRID_API_KEY.startsWith('SG.')) {
        await sgMail.send({
          to: destinatario,
          from: ENV.EMAIL_FROM,
          subject: asunto,
          html: contenido
        });
        console.log(`[Email] Correo enviado a ${destinatario}`);
      } else {
        console.log(`[Email Mock] Simulación de correo a ${destinatario} con enlace: ${enlace}`);
      }
      return true;
    } catch (err) {
      console.error('[Email Error] No se pudo enviar el correo:', err.message);
      // No bloqueamos el flujo si SendGrid falla en ambiente local
      return false;
    }
  }
};
