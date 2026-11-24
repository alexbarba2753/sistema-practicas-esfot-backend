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
    const textoPlano = [
      'Sistema de Prácticas Preprofesionales - ESFOT (EPN)',
      '',
      'Has solicitado restablecer tu contraseña.',
      `Abre el siguiente enlace para crear una nueva contraseña (válido por 1 hora): ${enlace}`,
      '',
      'Si no solicitaste este cambio, puedes ignorar este correo.'
    ].join('\n');

    const contenido = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body style="margin: 0; padding: 0; background-color: #f4f6f9; font-family: 'Segoe UI', Arial, Helvetica, sans-serif; color: #1f2937;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f4f6f9; padding: 32px 16px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden;">
                <tr>
                  <td style="background-color: #003366; padding: 24px 32px; text-align: center; border-bottom: 4px solid #b91c1c;">
                    <p style="margin: 0; font-size: 12px; letter-spacing: 1.5px; text-transform: uppercase; color: #cbd5e1; font-weight: 600;">
                      Escuela Politécnica Nacional
                    </p>
                    <h1 style="margin: 6px 0 0 0; font-size: 20px; line-height: 1.3; color: #ffffff; font-weight: 700;">
                      ESFOT - Sistema de Prácticas Preprofesionales
                    </h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 32px;">
                    <h2 style="margin: 0 0 16px 0; font-size: 20px; color: #003366; font-weight: 700;">
                      Recuperación de contraseña
                    </h2>
                    <p style="margin: 0 0 14px 0; font-size: 15px; line-height: 1.6; color: #374151;">
                      Recibimos una solicitud para restablecer la contraseña de tu cuenta en la plataforma de Prácticas Preprofesionales.
                    </p>
                    <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #374151;">
                      Haz clic en el siguiente botón para definir una nueva contraseña:
                    </p>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto 24px auto;">
                      <tr>
                        <td align="center" style="background-color: #003366; border-radius: 6px;">
                          <a href="${enlace}" target="_blank" style="display: inline-block; padding: 13px 28px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 6px;">
                            Restablecer Contraseña
                          </a>
                        </td>
                      </tr>
                    </table>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #fef3c7; border-left: 4px solid #d97706; border-radius: 4px; margin-bottom: 22px;">
                      <tr>
                        <td style="padding: 12px 16px; font-size: 13px; line-height: 1.5; color: #92400e;">
                          <strong>Importante:</strong> Este enlace es de un solo uso y expirará automáticamente en <strong>1 hora</strong>.
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 0 0 6px 0; font-size: 13px; color: #6b7280;">
                      Si el botón no funciona, copia y pega este enlace en tu navegador:
                    </p>
                    <p style="margin: 0 0 20px 0; font-size: 12px; line-height: 1.5; word-break: break-all; background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px; padding: 10px 12px; color: #1d4ed8;">
                      <a href="${enlace}" target="_blank" style="color: #1d4ed8; text-decoration: underline;">${enlace}</a>
                    </p>
                    <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #6b7280;">
                      Si no solicitaste restablecer tu contraseña, puedes ignorar este mensaje de forma segura.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="background-color: #f9fafb; padding: 18px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0; font-size: 12px; color: #6b7280;">
                      Escuela de Formación de Tecnólogos (ESFOT) - EPN
                    </p>
                    <p style="margin: 4px 0 0 0; font-size: 11px; color: #9ca3af;">
                      Mensaje automático del sistema. Por favor, no respondas a este correo.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    try {
      const [response] = await sgMail.send({
        to: String(destinatario).trim(),
        from: remitente,
        subject: asunto,
        text: textoPlano,
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
