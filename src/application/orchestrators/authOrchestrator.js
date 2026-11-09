import { authService } from '../services/authService.js';

// orquestador para coordinar los flujos de autenticacion y cuentas
export const authOrchestrator = {
  // valida el correo y la contraseña para que el usuario pueda entrar y recibir su token jwt
  async iniciarSesion(correo, password) {
    return await authService.iniciarSesion(correo, password);
  },

  // saca la informacion del perfil del usuario que esta conectado en la sesion actual
  async obtenerMiPerfil(usuarioId) {
    return await authService.obtenerMiPerfil(usuarioId);
  },

  // busca el correo del usuario y genera un token temporal para enviarle el link de reseteo
  async solicitarRecuperacionClave(correo) {
    return await authService.solicitarRecuperacionClave(correo);
  },

  // verifica el token que le llego al usuario y le guarda la nueva contraseña ya cifrada
  async restablecerClave(token, nuevoPassword) {
    return await authService.restablecerClave(token, nuevoPassword);
  }
};
