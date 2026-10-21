import { jest } from '@jest/globals';
import { estudianteOrchestrator } from '../src/application/orchestrators/estudianteOrchestrator.js';
import { expedienteService } from '../src/application/services/expedienteService.js';
import { actividadService } from '../src/application/services/actividadService.js';
import { convalidacionService } from '../src/application/services/convalidacionService.js';
import { asistenteIaService } from '../src/application/services/asistenteIaService.js';

describe('Pruebas del modulo Estudiante (estudianteOrchestrator)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Consulta de aulas asignadas y progreso', () => {
    it('debe obtener las aulas del estudiante con calculo de horas', async () => {
      const mockAulas = {
        success: true,
        total: 1,
        aulas: [
          {
            _id: 'aula101',
            nombre: 'Practicas Laborales 2026-B',
            modalidad: 'laboral',
            resumenHoras: {
              horasAprobadas: 160,
              horasRequeridas: 240,
              porcentajeCompletado: 67
            }
          }
        ]
      };

      jest.spyOn(expedienteService, 'obtenerAulasEstudiante').mockResolvedValue(mockAulas);

      const resultado = await estudianteOrchestrator.obtenerAulas('est123');
      expect(resultado.success).toBe(true);
      expect(resultado.aulas[0].resumenHoras.horasAprobadas).toBe(160);
      expect(expedienteService.obtenerAulasEstudiante).toHaveBeenCalledWith('est123');
    });
  });

  describe('Registro de actividades en bitacora FCP-002', () => {
    it('debe registrar una jornada laboral exitosamente', async () => {
      const mockActividad = {
        success: true,
        message: 'Jornada laboral registrada exitosamente en la bitacora',
        actividad: {
          _id: 'act101',
          horas: 8,
          horaEntrada: '08:00',
          horaSalida: '16:00',
          descripcion: 'Desarrollo de servicios RESTful y documentacion'
        }
      };

      jest.spyOn(actividadService, 'crearActividadLaboral').mockResolvedValue(mockActividad);

      const resultado = await estudianteOrchestrator.crearActividadLaboral('est123', 'aula101', {
        fecha: '2026-10-05',
        horaEntrada: '08:00',
        horaSalida: '16:00',
        horas: 8,
        descripcion: 'Desarrollo de servicios RESTful y documentacion'
      });

      expect(resultado.success).toBe(true);
      expect(resultado.actividad.horas).toBe(8);
      expect(actividadService.crearActividadLaboral).toHaveBeenCalledTimes(1);
    });
  });

  describe('Convalidacion de certificados de cursos externos', () => {
    it('debe registrar un certificado de Cisco o Udemy para convalidacion', async () => {
      const mockCertificado = {
        success: true,
        message: 'Certificado de formacion continua registrado para auditoria y convalidacion',
        certificado: {
          _id: 'cert01',
          plataforma: 'Cisco Networking Academy',
          nombreCurso: 'CCNA: Introduction to Networks',
          horasCertificadas: 40,
          estado: 'pendiente'
        }
      };

      jest.spyOn(convalidacionService, 'registrarCertificado').mockResolvedValue(mockCertificado);

      const resultado = await estudianteOrchestrator.registrarCertificado('est123', 'aula101', {
        plataforma: 'Cisco Networking Academy',
        nombreCurso: 'CCNA: Introduction to Networks',
        horasCertificadas: 40
      });

      expect(resultado.success).toBe(true);
      expect(resultado.certificado.horasCertificadas).toBe(40);
      expect(convalidacionService.registrarCertificado).toHaveBeenCalledTimes(1);
    });
  });

  describe('Consultas al asistente de normativas (RAG)', () => {
    it('debe responder consultas sobre reglamentos institucionales', async () => {
      const mockRespuestaIa = {
        success: true,
        respuesta: 'Las practicas laborales comprenden 240 horas y el servicio comunitario 96 horas.',
        fuentesConsultadas: ['RRA - Practicas Preprofesionales']
      };

      jest.spyOn(asistenteIaService, 'consultarNormativa').mockResolvedValue(mockRespuestaIa);

      const resultado = await estudianteOrchestrator.consultarNormativa('cuantas horas son de practicas laborales');
      expect(resultado.success).toBe(true);
      expect(resultado.respuesta).toContain('240 horas');
      expect(asistenteIaService.consultarNormativa).toHaveBeenCalledTimes(1);
    });
  });

  describe('Entrega formal del expediente al tutor', () => {
    it('debe procesar la entrega del expediente si se cumplen los requisitos', async () => {
      const mockEntrega = {
        success: true,
        message: 'Expediente de practicas entregado formalmente al docente tutor para su aprobacion',
        fechaEntrega: new Date('2026-10-20')
      };

      jest.spyOn(expedienteService, 'entregarExpediente').mockResolvedValue(mockEntrega);

      const resultado = await estudianteOrchestrator.entregarExpediente('aula101', 'est123');
      expect(resultado.success).toBe(true);
      expect(resultado.message).toContain('entregado formalmente');
      expect(expedienteService.entregarExpediente).toHaveBeenCalledWith('aula101', 'est123');
    });
  });
});
