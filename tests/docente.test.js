import { jest } from '@jest/globals';
import { docenteOrchestrator } from '../src/application/orchestrators/docenteOrchestrator.js';
import { expedienteService } from '../src/application/services/expedienteService.js';
import { actividadService } from '../src/application/services/actividadService.js';
import { AulaVirtual } from '../src/infrastructure/database/models/AulaVirtual.js';
import { FormularioPendiente } from '../src/infrastructure/database/models/FormularioPendiente.js';

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

  describe('Evaluacion de seguimiento institucional y observaciones del tutor', () => {
    it('debe registrar el seguimiento docente y remitir el expediente a comision', async () => {
      const mockResultado = {
        success: true,
        message: 'Seguimiento docente registrado y expediente remitido a la Comision de Practicas.',
        estado: 'pendiente_comision',
        seguimientoTutor: {
          satisfaccionObjetivos: 'SI',
          nivelPreparacionEstudiante: 'SI',
          recomendacionContinuidad: 'SI'
        }
      };

      jest.spyOn(expedienteService, 'evaluarSeguimientoDocente').mockResolvedValue(mockResultado);

      const resultado = await docenteOrchestrator.evaluarSeguimientoDocente('aula201', 'docente123', {
        seguimientos: [
          { tipo: 'inicio', fecha: '2026-05-10', descripcion: 'Definicion de metas' },
          { tipo: 'mitad', fecha: '2026-06-15', descripcion: 'Revision de avance' },
          { tipo: 'fin', fecha: '2026-07-20', descripcion: 'Evaluacion final' }
        ],
        satisfaccionObjetivos: 'SI',
        nivelPreparacionEstudiante: 'SI',
        recomendacionContinuidad: 'SI',
        remitirAComision: true
      });

      expect(resultado.success).toBe(true);
      expect(resultado.estado).toBe('pendiente_comision');
      expect(expedienteService.evaluarSeguimientoDocente).toHaveBeenCalledTimes(1);
    });

    it('debe permitir al docente registrar N actividades de seguimiento continuas sin limitarse a 3 momentos fijos', async () => {
      const mockAula = {
        _id: 'aula201',
        docenteTutor: 'docente123',
        horasRequeridas: 240,
        save: jest.fn().mockResolvedValue(true)
      };
      jest.spyOn(AulaVirtual, 'findOne').mockResolvedValue(mockAula);

      const mockFormulario = {
        _id: 'form201',
        aulaVirtual: 'aula201',
        estado: 'en_revision',
        totalHoras: 240,
        seguimientoTutor: {},
        save: jest.fn().mockResolvedValue(true)
      };
      jest.spyOn(FormularioPendiente, 'findOne').mockResolvedValue(mockFormulario);

      const actividadesContinuas = [
        { actividad: 'Reunion 1: Planificacion y cronograma inicial', fecha: new Date('2026-05-10'), resultados: 'Objetivos coordinados' },
        { actividad: 'Reunion 2: Revision de bitacoras quincenales', fecha: new Date('2026-05-25'), resultados: 'Avance de 40 horas verificado' },
        { actividad: 'Reunion 3: Contacto telefonico con el supervisor empresarial', fecha: new Date('2026-06-15'), resultados: 'Desempeno satisfactorio' },
        { actividad: 'Reunion 4: Revision intermedia de informe de practicas', fecha: new Date('2026-07-01'), resultados: 'Correccion tecnica realizada' },
        { actividad: 'Reunion 5: Evaluacion final y cierre de seguimiento', fecha: new Date('2026-07-20'), resultados: '240 horas cumplidas' }
      ];

      const resultado = await docenteOrchestrator.evaluarSeguimientoDocente('aula201', 'docente123', {
        actividadesSeguimiento: actividadesContinuas,
        conformidadPlan: true,
        observacionesPlan: 'Seguimiento continuo y flexible ejecutado exitosamente',
        remitirAComision: true
      });

      expect(resultado.success).toBe(true);
      expect(resultado.formulario.seguimientoTutor.actividadesSeguimiento).toHaveLength(5);
      expect(resultado.formulario.seguimientoTutor.actividadesSeguimiento[0].actividad).toContain('cronograma inicial');
      expect(resultado.formulario.seguimientoTutor.actividadesSeguimiento[4].actividad).toContain('cierre de seguimiento');
      expect(resultado.formulario.estado).toBe('pendiente_comision');
      expect(mockFormulario.save).toHaveBeenCalledTimes(1);
    });

    it('debe desbloquear el aula (aula.expedienteEntregado = false) y marcar formulario como observado cuando el tutor devuelve con observaciones', async () => {
      const mockAula = {
        _id: 'aula201',
        docenteTutor: 'docente123',
        expedienteEntregado: true,
        save: jest.fn().mockResolvedValue(true)
      };
      jest.spyOn(AulaVirtual, 'findOne').mockResolvedValue(mockAula);

      const mockFormulario = {
        _id: 'form201',
        aulaVirtual: 'aula201',
        estado: 'en_revision',
        seguimientoTutor: {},
        save: jest.fn().mockResolvedValue(true)
      };
      jest.spyOn(FormularioPendiente, 'findOne').mockResolvedValue(mockFormulario);

      const resultado = await docenteOrchestrator.evaluarSeguimientoDocente('aula201', 'docente123', {
        estado: 'observado',
        observaciones: 'Subsanar firmas en bitacora FCP-002 y adjuntar certificado convalidado'
      });

      expect(resultado.success).toBe(true);
      expect(resultado.message).toContain('devuelto al estudiante para correcciones');
      expect(mockAula.expedienteEntregado).toBe(false);
      expect(mockAula.save).toHaveBeenCalledTimes(1);
      expect(mockFormulario.estado).toBe('observado');
      expect(mockFormulario.seguimientoTutor.observacionesMejora).toBe('Subsanar firmas en bitacora FCP-002 y adjuntar certificado convalidado');
      expect(mockFormulario.save).toHaveBeenCalledTimes(1);
    });

    it('debe desbloquear el aula cuando el tutor envia la bandera devolverAEstudiante en true', async () => {
      const mockAula = {
        _id: 'aula201',
        docenteTutor: 'docente123',
        expedienteEntregado: true,
        save: jest.fn().mockResolvedValue(true)
      };
      jest.spyOn(AulaVirtual, 'findOne').mockResolvedValue(mockAula);

      const mockFormulario = {
        _id: 'form201',
        aulaVirtual: 'aula201',
        estado: 'en_revision',
        seguimientoTutor: {},
        save: jest.fn().mockResolvedValue(true)
      };
      jest.spyOn(FormularioPendiente, 'findOne').mockResolvedValue(mockFormulario);

      const resultado = await docenteOrchestrator.evaluarSeguimientoDocente('aula201', 'docente123', {
        devolverAEstudiante: true,
        observaciones: 'Completar objetivos especificos en el informe'
      });

      expect(resultado.success).toBe(true);
      expect(mockAula.expedienteEntregado).toBe(false);
      expect(mockAula.save).toHaveBeenCalledTimes(1);
      expect(mockFormulario.estado).toBe('observado');
    });

    it('debe rechazar el dictamen del docente si aun no completa la Seccion 6', async () => {
      jest.spyOn(AulaVirtual, 'findOne').mockResolvedValue({
        _id: 'aula201',
        docenteTutor: 'docente123',
        estado: 'activa',
        expedienteEntregado: true,
        horasRequeridas: 240
      });
      jest.spyOn(actividadService, 'calcularHorasAula').mockResolvedValue({
        horasAprobadas: 240
      });
      jest.spyOn(FormularioPendiente, 'findOne').mockResolvedValue({
        _id: 'form201',
        aulaVirtual: 'aula201',
        estado: 'en_revision',
        seguimientoTutor: { completadoPorTutor: false }
      });

      await expect(
        docenteOrchestrator.cerrarPractica('aula201', 'docente123', { dictamen: 'Aprobado' })
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('debe bloquear edicion de Seccion 6 y nuevo dictamen una vez aprobado por el docente', async () => {
      jest.spyOn(AulaVirtual, 'findOne').mockResolvedValue({
        _id: 'aula201',
        docenteTutor: 'docente123',
        estado: 'activa',
        expedienteEntregado: true,
        horasRequeridas: 240
      });
      jest.spyOn(actividadService, 'calcularHorasAula').mockResolvedValue({
        horasAprobadas: 240
      });
      jest.spyOn(FormularioPendiente, 'findOne').mockResolvedValue({
        _id: 'form201',
        aulaVirtual: 'aula201',
        estado: 'aprobado_docente',
        seguimientoTutor: { completadoPorTutor: true }
      });

      await expect(
        docenteOrchestrator.evaluarSeguimientoDocente('aula201', 'docente123', {
          observacionesPlan: 'Intento de edicion posterior'
        })
      ).rejects.toMatchObject({ statusCode: 400 });

      await expect(
        docenteOrchestrator.cerrarPractica('aula201', 'docente123', {
          dictamen: 'No Aprobado',
          observaciones: 'Intento de cambio de dictamen'
        })
      ).rejects.toMatchObject({ statusCode: 400 });
    });
  });
});
