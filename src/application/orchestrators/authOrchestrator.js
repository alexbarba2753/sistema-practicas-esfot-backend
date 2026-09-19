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
  }
};
