import { expedienteService } from '../services/expedienteService.js';
import { actividadService } from '../services/actividadService.js';
import { convalidacionService } from '../services/convalidacionService.js';
import { asistenteIaService } from '../services/asistenteIaService.js';

// Orquestador que coordina todas las operaciones del estudiante
export const estudianteOrchestrator = {
  async obtenerAulas(estudianteId) {
    return await expedienteService.obtenerAulasEstudiante(estudianteId);
  },

  async consultarNormativa(pregunta) {
    return await asistenteIaService.consultarNormativa(pregunta);
  },

  async crearActividadLaboral(estudianteId, aulaId, datos) {
    return await actividadService.crearActividadLaboral(estudianteId, aulaId, datos);
  },

  async listarActividadesLaborales(aulaId, filtros) {
    return await actividadService.listarActividadesLaborales(aulaId, filtros);
  },

  async crearActividadComunitaria(estudianteId, aulaId, datos) {
    return await actividadService.crearActividadComunitaria(estudianteId, aulaId, datos);
  },

  async listarActividadesComunitarias(aulaId, filtros) {
    return await actividadService.listarActividadesComunitarias(aulaId, filtros);
  },

  async registrarCertificado(estudianteId, aulaId, datos) {
    return await convalidacionService.registrarCertificado(estudianteId, aulaId, datos);
  },

  async listarCertificados(aulaId) {
    return await convalidacionService.listarCertificados(aulaId);
  },

  async obtenerFormularioPendiente(aulaId) {
    return await expedienteService.obtenerFormularioPendiente(aulaId);
  },

  async actualizarFormularioPendiente(aulaId, estudianteId, datos) {
    return await expedienteService.actualizarFormularioPendiente(aulaId, estudianteId, datos);
  },

  async generarBorradorInforme(aulaId, estudianteId) {
    return await asistenteIaService.generarBorradorInforme(aulaId, estudianteId);
  },

  async entregarExpediente(aulaId, estudianteId) {
    return await expedienteService.entregarExpediente(aulaId, estudianteId);
  }
};
