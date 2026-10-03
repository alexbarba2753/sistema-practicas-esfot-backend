import { usuarioService } from '../services/usuarioService.js';
import { aulaService } from '../services/aulaService.js';
import { fuenteService } from '../services/fuenteService.js';

// Orquestador que coordina los servicios del panel de administracion
export const adminOrchestrator = {
  // Gestion de Cuentas de Usuarios
  async crearUsuario(datos) {
    return await usuarioService.crear(datos);
  },

  async listarUsuarios(filtros) {
    return await usuarioService.listarUsuarios(filtros);
  },

  async obtenerUsuario(id) {
    return await usuarioService.obtenerUsuarioPorId(id);
  },

  async actualizarUsuario(id, datos) {
    return await usuarioService.actualizar(id, datos);
  },

  async cambiarEstadoUsuario(id, estado) {
    return await usuarioService.cambiarEstadoUsuario(id, estado);
  },

  // Gestion y Parametrizacion de Aulas Virtuales
  async crearAula(datos) {
    return await aulaService.crearAula(datos);
  },

  async listarAulas(filtros) {
    return await aulaService.listarAulas(filtros);
  },

  async obtenerAula(id) {
    return await aulaService.obtenerAulaPorId(id);
  },

  async actualizarAula(id, datos) {
    return await aulaService.actualizarAula(id, datos);
  },

  async cambiarEstadoAula(id, estado) {
    return await aulaService.cambiarEstadoAula(id, estado);
  },

  async asignarEstudiante(aulaId, estudianteId) {
    return await aulaService.asignarEstudiante(aulaId, estudianteId);
  },

  async desasignarEstudiante(aulaId) {
    return await aulaService.desasignarEstudiante(aulaId);
  },

  // Gestion e Ingesta de Fuentes Normativas RAG
  async ingestarFuente(datos, adminId) {
    return await fuenteService.ingestarFuente(datos, adminId);
  },

  async listarFuentes(filtros) {
    return await fuenteService.listarFuentes(filtros);
  },

  async obtenerFuente(id) {
    return await fuenteService.obtenerFuentePorId(id);
  },

  async actualizarFuente(id, datos) {
    return await fuenteService.actualizarFuente(id, datos);
  },

  async cambiarEstadoFuente(id, activo) {
    return await fuenteService.cambiarEstadoFuente(id, activo);
  },

  async eliminarFuente(id) {
    return await fuenteService.eliminarFuente(id);
  }
};
