import { authService } from '../services/authService.js';

// Orquestador que coordina los flujos de autenticacion y recuperacion de cuentas
export const authOrchestrator = {
  async iniciarSesion(correo, password) {
    return await authService.iniciarSesion(correo, password);
  },

  async obtenerMiPerfil(usuarioId) {
    return await authService.obtenerMiPerfil(usuarioId);
  },

  async solicitarRecuperacionClave(correo) {
    return await authService.solicitarRecuperacionClave(correo);
  },

  async restablecerClave(token, nuevoPassword) {
    return await authService.restablecerClave(token, nuevoPassword);
  }
};
