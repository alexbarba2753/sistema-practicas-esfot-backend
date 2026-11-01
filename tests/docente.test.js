import { jest } from '@jest/globals';
import { docenteOrchestrator } from '../src/application/orchestrators/docenteOrchestrator.js';
import { expedienteService } from '../src/application/services/expedienteService.js';
import { actividadService } from '../src/application/services/actividadService.js';
import { convalidacionService } from '../src/application/services/convalidacionService.js';

describe('Pruebas del modulo Docente Tutor (docenteOrchestrator)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Supervision y seguimiento de aulas asignadas', () => {
    it('debe listar las aulas virtuales asignadas al docente tutor', async () => {
      const mockAulas = {
        success: true,
        total: 1,
        aulas: [
          {
            _id: 'aula201',
            nombre: 'Practicas Laborales - Estudiante Juan Perez',
            resumenHoras: {
              horasAprobadas: 240,
              cumplioRequisito: true
            }
          }
        ]
      };

      jest.spyOn(expedienteService, 'obtenerAulasDocente').mockResolvedValue(mockAulas);

      const resultado = await docenteOrchestrator.listarAulas('docente123');
      expect(resultado.success).toBe(true);
      expect(resultado.aulas).toHaveLength(1);
      expect(expedienteService.obtenerAulasDocente).toHaveBeenCalledWith('docente123');
    });

    it('debe obtener el detalle individual de un aula con su estudiante y formulario', async () => {
      const mockDetalle = {
        success: true,
        aula: {
          _id: 'aula201',
          nombre: 'Practicas Laborales - 2026-B',
          expedienteEntregado: true
        }
      };

      jest.spyOn(expedienteService, 'obtenerDetalleAulaDocente').mockResolvedValue(mockDetalle);

      const resultado = await docenteOrchestrator.obtenerDetalleAula('aula201', 'docente123');
      expect(resultado.success).toBe(true);
      expect(resultado.aula.expedienteEntregado).toBe(true);
      expect(expedienteService.obtenerDetalleAulaDocente).toHaveBeenCalledWith('aula201', 'docente123');
    });
  });

  describe('Evaluacion de actividades de la bitacora FCP-002', () => {
    it('debe permitir al docente aprobar una actividad laboral con observaciones', async () => {
      const mockEvaluacion = {
        success: true,
        message: 'Actividad laboral aprobada exitosamente',
        actividad: {
          _id: 'act001',
          estadoAprobacion: 'aprobado',
          observacionesDocente: 'Tareas verificadas correctamente'
        }
      };

      jest.spyOn(actividadService, 'evaluarActividadLaboral').mockResolvedValue(mockEvaluacion);

      const resultado = await docenteOrchestrator.evaluarActividadLaboral('act001', 'docente123', {
        estado: 'aprobado',
        observacionesDocente: 'Tareas verificadas correctamente'
      });

      expect(resultado.success).toBe(true);
      expect(resultado.actividad.estadoAprobacion).toBe('aprobado');
      expect(actividadService.evaluarActividadLaboral).toHaveBeenCalledTimes(1);
    });

    it('debe permitir al docente evaluar una actividad comunitaria', async () => {
      const mockEvaluacion = {
        success: true,
        message: 'Actividad comunitaria aprobada exitosamente',
        actividad: {
          _id: 'com001',
          estadoAprobacion: 'aprobado'
        }
      };

      jest.spyOn(actividadService, 'evaluarActividadComunitaria').mockResolvedValue(mockEvaluacion);

      const resultado = await docenteOrchestrator.evaluarActividadComunitaria('com001', 'docente123', {
        estado: 'aprobado'
      });

      expect(resultado.success).toBe(true);
      expect(resultado.actividad.estadoAprobacion).toBe('aprobado');
    });
  });

  describe('Evaluacion de convalidaciones de cursos externos', () => {
    it('debe permitir al docente acreditar horas de un curso de Cisco o Udemy', async () => {
      const mockCertificado = {
        _id: 'cert01',
        plataforma: 'Udemy',
        nombreCurso: 'Fullstack Modern JavaScript',
        horasCertificadas: 30,
        horasAcreditadas: 30,
        estado: 'aprobada'
      };

      jest.spyOn(convalidacionService, 'evaluarCertificado').mockResolvedValue(mockCertificado);

      const resultado = await docenteOrchestrator.evaluarConvalidacion('cert01', {
        aprobada: true,
        horasAcreditadas: 30,
        observaciones: 'Certificado verificado en plataforma'
      });

      expect(resultado.estado).toBe('aprobada');
      expect(resultado.horasAcreditadas).toBe(30);
      expect(convalidacionService.evaluarCertificado).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cierre formal de practica y emision de acta FCP-004', () => {
    it('debe cerrar formalmente el aula virtual y emitir el dictamen final', async () => {
      const mockCierre = {
        success: true,
        message: 'Practica aprobada y cerrada formalmente. Acta FCP-004 emitida.',
        actaAprobacion: {
          _id: 'acta999',
          dictamen: 'Aprobado',
          calificacionTutor: 20,
          estado: 'aprobado'
        },
        aulaEstado: 'cerrada'
      };

      jest.spyOn(expedienteService, 'cerrarProcesoDocente').mockResolvedValue(mockCierre);

      const resultado = await docenteOrchestrator.cerrarPractica('aula201', 'docente123', {
        dictamen: 'Aprobado',
        calificacion: 20,
        observacionesFinales: 'Excelente desempeño del estudiante'
      });

      expect(resultado.success).toBe(true);
      expect(resultado.aulaEstado).toBe('cerrada');
      expect(resultado.actaAprobacion.dictamen).toBe('Aprobado');
      expect(expedienteService.cerrarProcesoDocente).toHaveBeenCalledTimes(1);
    });
  });
});
