import { expedienteService } from '../services/expedienteService.js';
import { actividadService } from '../services/actividadService.js';
import { convalidacionService } from '../services/convalidacionService.js';

// Orquestador que coordina todas las operaciones del docente tutor
export const docenteOrchestrator = {
  async listarAulas(docenteId) {
    return await expedienteService.obtenerAulasDocente(docenteId);
  },

  async obtenerDetalleAula(aulaId, docenteId) {
    return await expedienteService.obtenerDetalleAulaDocente(aulaId, docenteId);
  },

  async listarActividadesLaborales(aulaId, filtros) {
    return await actividadService.listarActividadesLaborales(aulaId, filtros);
  },

  async evaluarActividadLaboral(actividadId, docenteId, datos) {
    return await actividadService.evaluarActividadLaboral(actividadId, docenteId, datos);
  },

  async listarActividadesComunitarias(aulaId, filtros) {
    return await actividadService.listarActividadesComunitarias(aulaId, filtros);
  },

  async evaluarActividadComunitaria(actividadId, docenteId, datos) {
    return await actividadService.evaluarActividadComunitaria(actividadId, docenteId, datos);
  },

  async listarConvalidaciones(aulaId) {
    return await convalidacionService.listarCertificados(aulaId);
  },

  async evaluarConvalidacion(certificadoId, datos) {
    return await convalidacionService.evaluarCertificado(certificadoId, datos);
  },

  async obtenerFormularioPendiente(aulaId) {
    return await expedienteService.obtenerFormularioPendiente(aulaId);
  },

  async cerrarPractica(aulaId, docenteId, datos) {
    return await expedienteService.cerrarProcesoDocente(aulaId, docenteId, datos);
  }
};
