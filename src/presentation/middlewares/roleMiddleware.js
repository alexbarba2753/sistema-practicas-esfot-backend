import { errorHttp } from '../../domain/utils/errorHttp.js';

export const requireRole = (...rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.usuario) {
      return next(errorHttp('Usuario no autenticado', 401));
    }

    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return next(
        errorHttp(
          `Acceso denegado: Se requiere rol de [${rolesPermitidos.join(', ')}], tu rol actual es [${req.usuario.rol}]`,
          403
        )
      );
    }

    next();
  };
};
