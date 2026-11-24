import { jest, describe, test, expect, afterEach } from '@jest/globals';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { ENV } from '../src/infrastructure/config/env.js';
import { authOrchestrator } from '../src/application/orchestrators/authOrchestrator.js';
import { authService } from '../src/application/services/authService.js';
import { usuarioService } from '../src/application/services/usuarioService.js';
import { emailAdapter } from '../src/infrastructure/adapters/emailAdapter.js';

describe('Pruebas Unitarias de Autenticacion y Seguridad', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('debe hashear contraseñas con bcrypt correctamente', async () => {
    const clavePlana = 'Password123!';
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(clavePlana, salt);

    expect(hash).toBeDefined();
    expect(hash).not.toBe(clavePlana);

    const esValido = await bcrypt.compare(clavePlana, hash);
    expect(esValido).toBe(true);

    const esInvalido = await bcrypt.compare('PasswordErroneo', hash);
    expect(esInvalido).toBe(false);
  });

  test('debe firmar y verificar tokens JWT con expiracion', () => {
    const payload = { id: 'user_123', rol: 'estudiante' };
    const token = jwt.sign(payload, ENV.JWT_SECRET, { expiresIn: '1h' });

    expect(token).toBeDefined();

    const decodificado = jwt.verify(token, ENV.JWT_SECRET);
    expect(decodificado.id).toBe('user_123');
    expect(decodificado.rol).toBe('estudiante');
  });

  test('debe rechazar tokens alterados o con firma invalida', () => {
    const payload = { id: 'user_123' };
    const token = jwt.sign(payload, 'otra_clave_secreta');

    expect(() => jwt.verify(token, ENV.JWT_SECRET)).toThrow();
  });

  test('debe delegar el inicio de sesion desde authOrchestrator hacia authService', async () => {
    const mockRespuesta = {
      success: true,
      message: 'Inicio de sesión exitoso',
      token: 'jwt_mock_token',
      usuario: { id: 'u1', correo: 'admin@esfot.epn.edu.ec', rol: 'administrador' }
    };

    jest.spyOn(authService, 'iniciarSesion').mockResolvedValue(mockRespuesta);

    const resultado = await authOrchestrator.iniciarSesion('admin@esfot.epn.edu.ec', 'AdminPassword123!');
    expect(resultado.success).toBe(true);
    expect(resultado.token).toBe('jwt_mock_token');
    expect(authService.iniciarSesion).toHaveBeenCalledWith('admin@esfot.epn.edu.ec', 'AdminPassword123!');
  });

  test('debe devolver token y correoEnviado=true cuando SendGrid confirma el envio', async () => {
    const mockUsuario = {
      _id: 'user_rec_1',
      correo: 'estudiante@esfot.epn.edu.ec',
      save: jest.fn().mockResolvedValue(true)
    };
    jest.spyOn(usuarioService, 'buscarPorCorreo').mockResolvedValue(mockUsuario);
    jest.spyOn(emailAdapter, 'enviarCorreoRecuperacion').mockResolvedValue({
      enviado: true,
      statusCode: 202,
      messageId: 'sg_msg_123'
    });

    const resultado = await authService.solicitarRecuperacionClave('estudiante@esfot.epn.edu.ec');

    expect(resultado.success).toBe(true);
    expect(resultado.correoEnviado).toBe(true);
    expect(resultado.messageId).toBe('sg_msg_123');
    expect(resultado.token).toBeDefined();
    expect(mockUsuario.save).toHaveBeenCalledTimes(1);
  });

  test('debe lanzar error y limpiar token si falla el envio del correo de recuperacion', async () => {
    const mockUsuario = {
      _id: 'user_rec_2',
      correo: 'docente@esfot.epn.edu.ec',
      save: jest.fn().mockResolvedValue(true)
    };
    jest.spyOn(usuarioService, 'buscarPorCorreo').mockResolvedValue(mockUsuario);
    jest.spyOn(emailAdapter, 'enviarCorreoRecuperacion').mockRejectedValue(
      Object.assign(new Error('No se pudo enviar el correo de recuperación'), { statusCode: 502 })
    );

    await expect(authService.solicitarRecuperacionClave('docente@esfot.epn.edu.ec')).rejects.toMatchObject({
      statusCode: 502
    });
    expect(mockUsuario.token).toBeUndefined();
    expect(mockUsuario.tokenExpiracion).toBeUndefined();
    expect(mockUsuario.save).toHaveBeenCalledTimes(2);
  });
});
