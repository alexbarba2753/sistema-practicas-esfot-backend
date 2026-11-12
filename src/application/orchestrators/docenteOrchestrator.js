import { expedienteService } from '../services/expedienteService.js';
import { actividadService } from '../services/actividadService.js';
import { convalidacionService } from '../services/convalidacionService.js';

// orquestador para coordinar las operaciones de revision y evaluacion del docente tutor
export const docenteOrchestrator = {
  // consulta las aulas virtuales que tiene a cargo el docente para ver el avance de sus alumnos
  async listarAulas(docenteId) {
    return await expedienteService.obtenerAulasDocente(docenteId);
  },

  // obtiene el detalle completo de un aula asignada incluyendo las horas y actividades
  async obtenerDetalleAula(aulaId, docenteId) {
    return await expedienteService.obtenerDetalleAulaDocente(aulaId, docenteId);
  },

  // lista todas las bitacoras laborales que el estudiante ha registrado en el aula
  async listarActividadesLaborales(aulaId, filtros) {
    return await actividadService.listarActividadesLaborales(aulaId, filtros);
  },

  // el tutor califica la actividad laboral como aprobada o rechazada y deja su observacion
  async evaluarActividadLaboral(actividadId, docenteId, datos) {
    return await actividadService.evaluarActividadLaboral(actividadId, docenteId, datos);
  },

  // lista las actividades comunitarias registradas por el estudiante para revision
  async listarActividadesComunitarias(aulaId, filtros) {
    return await actividadService.listarActividadesComunitarias(aulaId, filtros);
  },

  // evalua y aprueba las horas comunitarias reportadas por el estudiante
  async evaluarActividadComunitaria(actividadId, docenteId, datos) {
    return await actividadService.evaluarActividadComunitaria(actividadId, docenteId, datos);
  },

  // revisa los certificados externos que el estudiante subio para convalidar horas
  async listarConvalidaciones(aulaId) {
    return await convalidacionService.listarCertificados(aulaId);
  },

  // dictamina si el certificado es valido para convalidar horas reglamentarias
  async evaluarConvalidacion(certificadoId, datos) {
    return await convalidacionService.evaluarCertificado(certificadoId, datos);
  },

  // revisa el borrador del formulario del estudiante antes del dictamen final
  async obtenerFormularioPendiente(aulaId) {
    return await expedienteService.obtenerFormularioPendiente(aulaId);
  },

  // registra las 3 actividades de seguimiento obligatorio y la evaluacion cualitativa del tutor (punto 6/9)
  async evaluarSeguimientoDocente(aulaId, docenteId, datos) {
    return await expedienteService.evaluarSeguimientoDocente(aulaId, docenteId, datos);
  },

  // emite la calificacion final sobre 20, aprueba la practica y genera el acta oficial fcp-004
  async cerrarPractica(aulaId, docenteId, datos) {
    return await expedienteService.cerrarProcesoDocente(aulaId, docenteId, datos);
  },

  // descarga el informe tecnico oficial en formato excel para revision del tutor
  async descargarInforme(aulaId, docenteId) {
    return await expedienteService.descargarInformeExcel(aulaId, docenteId);
  }
};
