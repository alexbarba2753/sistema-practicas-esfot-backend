import jwt from 'jsonwebtoken';
import { ENV } from '../../infrastructure/config/env.js';
import { usuarioService } from '../services/usuarioService.js';
import { errorHttp } from '../../domain/utils/errorHttp.js';

export const authOrchestrator = {
  // Inicio de sesion para cualquier rol (estudiante, docente, admin)
  async iniciarSesion(correo, password) {
    if (!correo || !password) {
      throw errorHttp('Debe ingresar correo y contraseña', 400);
    }

    const usuario = await usuarioService.buscarPorCorreo(correo);
    if (!usuario) {
      throw errorHttp('Credenciales inválidas', 401);
    }

    const passwordValido = await usuarioService.compararPassword(password, usuario.password);
    if (!passwordValido) {
      throw errorHttp('Credenciales inválidas', 401);
    }

    if (usuario.estado !== 'activo') {
      throw errorHttp('Tu cuenta se encuentra inactiva, consulta con administración', 403);
    }

    // Generar token JWT con los datos clave
    const token = jwt.sign(
      { id: usuario._id, correo: usuario.correo, rol: usuario.rol },
      ENV.JWT_SECRET,
      { expiresIn: ENV.JWT_EXPIRES_IN }
    );

    return {
      success: true,
      message: 'Inicio de sesión exitoso',
      token,
      usuario: {
        id: usuario._id,
        cedula: usuario.cedula,
        nombres: usuario.nombres,
        apellidos: usuario.apellidos,
        correo: usuario.correo,
        rol: usuario.rol,
        telefono: usuario.telefono,
        estado: usuario.estado
      }
    };
  },

  // Consulta de perfil del usuario autenticado
  async obtenerMiPerfil(usuarioId) {
    const usuario = await usuarioService.buscarPorId(usuarioId);
    return {
      success: true,
      usuario
    };
  },

  // Solicitar restablecimiento de contraseña por correo institucional
  async solicitarRecuperacionClave(correo) {
    if (!correo) {
      throw errorHttp('Debe ingresar su correo electrónico', 400);
    }

    const usuario = await usuarioService.buscarPorCorreo(correo);
    // Por seguridad, si el usuario no existe no revelamos el dato
    if (!usuario) {
      return {
        success: true,
        message: 'Si el correo está registrado, se enviará un enlace de recuperación'
      };
    }

    // Generar token firmado para reseteo
    const resetToken = jwt.sign(
      { id: usuario._id, accion: 'recuperar_clave' },
      ENV.JWT_RESET_SECRET,
      { expiresIn: ENV.JWT_RESET_EXPIRES_IN }
    );

    usuario.resetPasswordToken = resetToken;
    usuario.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hora
    await usuario.save();

    const { emailAdapter } = await import('../../infrastructure/adapters/emailAdapter.js');
    await emailAdapter.enviarCorreoRecuperacion(usuario.correo, resetToken);

    return {
      success: true,
      message: 'Si el correo está registrado, se enviará un enlace de recuperación',
      ...(ENV.NODE_ENV === 'development' && { tokenDev: resetToken })
    };
  },

  // Restablecer contraseña con el token firmado
  async restablecerClave(token, nuevoPassword) {
    if (!token || !nuevoPassword) {
      throw errorHttp('Token y nueva contraseña son obligatorios', 400);
    }

    if (nuevoPassword.length < 6) {
      throw errorHttp('La nueva contraseña debe tener al menos 6 caracteres', 400);
    }

    let decoded;
    try {
      decoded = jwt.verify(token, ENV.JWT_RESET_SECRET);
    } catch (err) {
      throw errorHttp('El enlace de recuperación es inválido o ha expirado', 400);
    }

    const usuario = await usuarioService.buscarPorId(decoded.id);

    if (usuario.resetPasswordToken !== token || usuario.resetPasswordExpires < new Date()) {
      throw errorHttp('El token ya fue utilizado o ha expirado', 400);
    }

    usuario.password = await usuarioService.hashearPassword(nuevoPassword);
    usuario.resetPasswordToken = null;
    usuario.resetPasswordExpires = null;
    await usuario.save();

    return {
      success: true,
      message: 'Contraseña actualizada exitosamente. Ya puedes iniciar sesión con tu nueva clave'
    };
  }
};
