import { authOrchestrator } from '../../application/orchestrators/authOrchestrator.js';

export const authController = {
  async login(req, res, next) {
    try {
      const { correo, password } = req.body;
      const resultado = await authOrchestrator.iniciarSesion(correo, password);
      res.json(resultado);
    } catch (err) {
      next(err);
    }
  },

  async miPerfil(req, res, next) {
    try {
      const resultado = await authOrchestrator.obtenerMiPerfil(req.usuario._id);
      res.json(resultado);
    } catch (err) {
      next(err);
    }
  }
};
