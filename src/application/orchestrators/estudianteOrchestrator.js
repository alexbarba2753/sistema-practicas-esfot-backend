import { expedienteService } from '../services/expedienteService.js';
import { actividadService } from '../services/actividadService.js';
import { convalidacionService } from '../services/convalidacionService.js';
import { asistenteIaService } from '../services/asistenteIaService.js';

// orquestador para coordinar las operaciones que realiza el estudiante practicante
export const estudianteOrchestrator = {
  // consulta las aulas en las que esta matriculado el estudiante y el total de horas acumuladas
  async obtenerAulas(estudianteId) {
    return await expedienteService.obtenerAulasEstudiante(estudianteId);
  },

  // hace una pregunta sobre reglamentos o requisitos al modulo de consultas institucionales
  async consultarNormativa(pregunta) {
    return await asistenteIaService.consultarNormativa(pregunta);
  },

  // registra una jornada diaria de practicas laborales de maximo 8 horas en la bitacora
  async crearActividadLaboral(estudianteId, aulaId, datos) {
    return await actividadService.crearActividadLaboral(estudianteId, aulaId, datos);
  },

  // lista las actividades laborales que el estudiante ha registrado en su aula
  async listarActividadesLaborales(aulaId, filtros) {
    return await actividadService.listarActividadesLaborales(aulaId, filtros);
  },

  // guarda una actividad de servicio comunitario con la institucion y beneficiarios
  async crearActividadComunitaria(estudianteId, aulaId, datos) {
    return await actividadService.crearActividadComunitaria(estudianteId, aulaId, datos);
  },

  // muestra el historial de actividades comunitarias registradas en el aula
  async listarActividadesComunitarias(aulaId, filtros) {
    return await actividadService.listarActividadesComunitarias(aulaId, filtros);
  },

  // sube un certificado de cursos externos para solicitar convalidacion de horas
  async registrarCertificado(estudianteId, aulaId, datos) {
    return await convalidacionService.registrarCertificado(estudianteId, aulaId, datos);
  },

  // lista todos los certificados que el estudiante ha enviado a convalidacion
  async listarCertificados(aulaId) {
    return await convalidacionService.listarCertificados(aulaId);
  },

  // consulta los datos que tiene guardados en su formulario de informe fcp-001a
  async obtenerFormularioPendiente(aulaId) {
    return await expedienteService.obtenerFormularioPendiente(aulaId);
  },

  // actualiza los campos de la entidad receptora u horario en el formulario
  async actualizarFormularioPendiente(aulaId, estudianteId, datos) {
    return await expedienteService.actualizarFormularioPendiente(aulaId, estudianteId, datos);
  },

  // genera el borrador del informe tecnico tomando las actividades registradas en la bitacora
  async generarBorradorInforme(aulaId, estudianteId) {
    return await asistenteIaService.generarBorradorInforme(aulaId, estudianteId);
  },

  // hace la entrega formal del expediente al docente tutor una vez cumplidas las horas
  async entregarExpediente(aulaId, estudianteId) {
    return await expedienteService.entregarExpediente(aulaId, estudianteId);
  },

  // descarga el informe oficial en formato excel f_aa_119 o fcp_001a segun la modalidad
  async descargarInforme(aulaId, estudianteId) {
    return await expedienteService.descargarInformeExcel(aulaId, estudianteId);
  }
};
