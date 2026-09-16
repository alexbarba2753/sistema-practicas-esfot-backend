import jwt from 'jsonwebtoken';
import { ENV } from '../../infrastructure/config/env.js';
import { Usuario } from '../../infrastructure/database/models/Usuario.js';
import { errorHttp } from '../../domain/utils/errorHttp.js';

export const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw errorHttp('Acceso no autorizado: Token no proporcionado', 401);
    }

    const token = authHeader.split(' ')[1];

    let decoded;
    try {
      decoded = jwt.verify(token, ENV.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw errorHttp('La sesión ha expirado, inicia sesión nuevamente', 401);
      }
      throw errorHttp('Token de autenticación inválido', 401);
    }

    const usuario = await Usuario.findById(decoded.id);
    if (!usuario) {
      throw errorHttp('El usuario asociado al token ya no existe', 401);
    }

    if (usuario.estado !== 'activo') {
      throw errorHttp('Tu cuenta de usuario se encuentra inactiva', 403);
    }

    req.usuario = usuario;
    next();
  } catch (error) {
    next(error);
  }
};
