import sgMail from '@sendgrid/mail';
import { ENV } from '../config/env.js';
import { errorHttp } from '../../domain/utils/errorHttp.js';

export const emailAdapter = {
  async enviarCorreoRecuperacion(destinatario, token) {
    const apiKey = ENV.SENDGRID_API_KEY?.trim();
    const remitente = ENV.EMAIL_FROM?.trim();

    if (!apiKey || !apiKey.startsWith('SG.')) {
      throw errorHttp('El servicio de correo (SendGrid) no está configurado. Verifica SENDGRID_API_KEY.', 503);
    }

    if (!remitente) {
      throw errorHttp('El remitente de correo no está configurado. Verifica EMAIL_FROM.', 503);
    }

    if (!destinatario || !String(destinatario).trim()) {
      throw errorHttp('El usuario no tiene un correo destinatario válido.', 400);
    }

    sgMail.setApiKey(apiKey);

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
      const [response] = await sgMail.send({
        to: String(destinatario).trim(),
        from: remitente,
        subject: asunto,
        html: contenido
      });

      if (!response || response.statusCode < 200 || response.statusCode >= 300) {
        throw errorHttp(
          `SendGrid rechazó el envío del correo (status ${response?.statusCode || 'desconocido'})`,
          502
        );
      }

      const messageId = response.headers?.['x-message-id'] || null;
      console.log(`[Email] Correo enviado a ${destinatario} (status ${response.statusCode}, id: ${messageId})`);
      return {
        enviado: true,
        statusCode: response.statusCode,
        messageId
      };
    } catch (err) {
      if (err.statusCode) throw err;
      const detalle =
        err.response?.body?.errors?.map((e) => e.message).join('; ') || err.message;
      console.error('[Email Error] No se pudo enviar el correo:', detalle);
      throw errorHttp(`No se pudo enviar el correo de recuperación: ${detalle}`, 502);
    }
  }
};
