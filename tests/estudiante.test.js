import { jest } from '@jest/globals';
import { estudianteOrchestrator } from '../src/application/orchestrators/estudianteOrchestrator.js';
import { expedienteService } from '../src/application/services/expedienteService.js';
import { actividadService } from '../src/application/services/actividadService.js';
import { convalidacionService } from '../src/application/services/convalidacionService.js';
import { asistenteIaService } from '../src/application/services/asistenteIaService.js';
import { AulaVirtual } from '../src/infrastructure/database/models/AulaVirtual.js';
import { ActividadLaboral } from '../src/infrastructure/database/models/ActividadLaboral.js';
import { ActividadComunitaria } from '../src/infrastructure/database/models/ActividadComunitaria.js';
import { ConvalidacionCertificado } from '../src/infrastructure/database/models/ConvalidacionCertificado.js';
import { FormularioPendiente } from '../src/infrastructure/database/models/FormularioPendiente.js';
import { FuenteInstitucional } from '../src/infrastructure/database/models/FuenteInstitucional.js';

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

    it('debe actualizar una jornada laboral pendiente en la bitacora', async () => {
      const mockActualizada = {
        success: true,
        message: 'Jornada laboral actualizada exitosamente',
        actividad: {
          _id: 'act101',
          horas: 6,
          descripcion: 'Actualizacion de modulos y correccion de tests'
        }
      };

      jest.spyOn(actividadService, 'actualizarActividadLaboral').mockResolvedValue(mockActualizada);

      const resultado = await estudianteOrchestrator.actualizarActividadLaboral('est123', 'act101', {
        horas: 6,
        descripcion: 'Actualizacion de modulos y correccion de tests'
      });

      expect(resultado.success).toBe(true);
      expect(resultado.actividad.horas).toBe(6);
      expect(actividadService.actualizarActividadLaboral).toHaveBeenCalledWith('est123', 'act101', {
        horas: 6,
        descripcion: 'Actualizacion de modulos y correccion de tests'
      });
    });

    it('debe actualizar una actividad comunitaria pendiente', async () => {
      const mockActualizada = {
        success: true,
        message: 'Actividad comunitaria actualizada exitosamente',
        actividad: {
          _id: 'com101',
          horas: 5,
          descripcion: 'Capacitacion actualizada'
        }
      };

      jest.spyOn(actividadService, 'actualizarActividadComunitaria').mockResolvedValue(mockActualizada);

      const resultado = await estudianteOrchestrator.actualizarActividadComunitaria('est123', 'com101', {
        horas: 5,
        descripcion: 'Capacitacion actualizada'
      });

      expect(resultado.success).toBe(true);
      expect(resultado.actividad.horas).toBe(5);
      expect(actividadService.actualizarActividadComunitaria).toHaveBeenCalledWith('est123', 'com101', {
        horas: 5,
        descripcion: 'Capacitacion actualizada'
      });
    });

    it('debe permitir actualizar pasando aulaId si coincide con el aula de la actividad', async () => {
      const mockActualizada = {
        success: true,
        message: 'Jornada laboral actualizada exitosamente',
        actividad: { _id: 'act101', horas: 7 }
      };

      jest.spyOn(actividadService, 'actualizarActividadLaboral').mockResolvedValue(mockActualizada);

      const resultado = await estudianteOrchestrator.actualizarActividadLaboral('est123', 'act101', { horas: 7 }, 'aulaLaboral101');
      expect(resultado.success).toBe(true);
      expect(actividadService.actualizarActividadLaboral).toHaveBeenCalledWith('est123', 'act101', { horas: 7 }, 'aulaLaboral101');
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

    it('debe actualizar un certificado externo pendiente de aprobacion', async () => {
      const mockActualizado = {
        success: true,
        message: 'Certificado actualizado exitosamente y puesto en revision para el docente tutor',
        certificado: {
          _id: 'cert01',
          plataforma: 'Cisco Networking Academy',
          nombreCurso: 'CCNA: Switching, Routing, and Wireless Essentials',
          horasCertificadas: 40,
          estado: 'pendiente'
        }
      };

      jest.spyOn(convalidacionService, 'actualizarCertificado').mockResolvedValue(mockActualizado);

      const resultado = await estudianteOrchestrator.actualizarCertificado('est123', 'cert01', {
        nombreCurso: 'CCNA: Switching, Routing, and Wireless Essentials'
      });

      expect(resultado.success).toBe(true);
      expect(resultado.certificado.nombreCurso).toContain('Switching');
      expect(convalidacionService.actualizarCertificado).toHaveBeenCalledWith('est123', 'cert01', {
        nombreCurso: 'CCNA: Switching, Routing, and Wireless Essentials'
      });
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

  describe('Bloqueo estricto por entrega de expediente (HTTP 403 Forbidden)', () => {
    it('debe rechazar la creacion de jornada laboral (crearActividadLaboral) con HTTP 403 Forbidden cuando el expediente ya fue entregado', async () => {
      jest.spyOn(AulaVirtual, 'findById').mockResolvedValue({
        _id: 'aula101',
        estudiante: 'est123',
        modalidad: 'laboral',
        estado: 'abierta',
        expedienteEntregado: true
      });

      await expect(
        estudianteOrchestrator.crearActividadLaboral('est123', 'aula101', {
          fecha: '2026-10-05',
          horaEntrada: '08:00',
          horaSalida: '16:00',
          horas: 8,
          descripcion: 'Intento de registro laboral con expediente entregado'
        })
      ).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining('expediente ya fue entregado')
      });
    });

    it('debe rechazar la actualizacion de jornada laboral (actualizarActividadLaboral) con HTTP 403 Forbidden cuando el expediente ya fue entregado', async () => {
      jest.spyOn(ActividadLaboral, 'findOne').mockResolvedValue({
        _id: 'docLab101',
        estudiante: 'est123',
        aulaVirtual: 'aula101',
        actividades: [
          {
            _id: 'act101',
            estadoAprobacion: 'pendiente'
          }
        ]
      });
      jest.spyOn(AulaVirtual, 'findById').mockResolvedValue({
        _id: 'aula101',
        estudiante: 'est123',
        modalidad: 'laboral',
        estado: 'abierta',
        expedienteEntregado: true
      });

      await expect(
        estudianteOrchestrator.actualizarActividadLaboral('est123', 'act101', {
          horas: 6,
          descripcion: 'Intento de modificacion laboral con expediente entregado'
        })
      ).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining('expediente ya fue entregado')
      });
    });

    it('debe rechazar la creacion de actividad comunitaria (crearActividadComunitaria) con HTTP 403 Forbidden cuando el expediente ya fue entregado', async () => {
      jest.spyOn(AulaVirtual, 'findById').mockResolvedValue({
        _id: 'aulaCom01',
        estudiante: 'est123',
        modalidad: 'comunitario',
        estado: 'abierta',
        expedienteEntregado: true
      });

      await expect(
        estudianteOrchestrator.crearActividadComunitaria('est123', 'aulaCom01', {
          fecha: '2026-10-06',
          horas: 4,
          comunidadOInstitucion: 'Comunidad San Jose',
          descripcion: 'Intento de registro comunitario con expediente entregado'
        })
      ).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining('expediente ya fue entregado')
      });
    });

    it('debe rechazar la actualizacion de actividad comunitaria (actualizarActividadComunitaria) con HTTP 403 Forbidden cuando el expediente ya fue entregado', async () => {
      jest.spyOn(ActividadComunitaria, 'findById').mockResolvedValue({
        _id: 'com101',
        estudiante: 'est123',
        aulaVirtual: 'aulaCom01',
        estadoAprobacion: 'pendiente'
      });
      jest.spyOn(AulaVirtual, 'findById').mockResolvedValue({
        _id: 'aulaCom01',
        estudiante: 'est123',
        modalidad: 'comunitario',
        estado: 'abierta',
        expedienteEntregado: true
      });

      await expect(
        estudianteOrchestrator.actualizarActividadComunitaria('est123', 'com101', {
          horas: 5,
          descripcion: 'Intento de modificacion comunitaria con expediente entregado'
        })
      ).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining('expediente ya fue entregado')
      });
    });

    it('debe rechazar el registro de certificado de convalidacion (registrarCertificado) con HTTP 403 Forbidden cuando el expediente ya fue entregado', async () => {
      jest.spyOn(AulaVirtual, 'findById').mockResolvedValue({
        _id: 'aula101',
        estudiante: 'est123',
        estado: 'abierta',
        expedienteEntregado: true
      });

      await expect(
        estudianteOrchestrator.registrarCertificado('est123', 'aula101', {
          plataforma: 'Cisco Networking Academy',
          nombreCurso: 'CCNA: Enterprise Networking',
          horasCertificadas: 40
        })
      ).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining('expediente ya fue entregado')
      });
    });

    it('debe rechazar la actualizacion de certificado de convalidacion (actualizarCertificado) con HTTP 403 Forbidden cuando el expediente ya fue entregado', async () => {
      jest.spyOn(ConvalidacionCertificado, 'findById').mockResolvedValue({
        _id: 'cert101',
        estudiante: 'est123',
        aulaVirtual: 'aula101',
        estado: 'pendiente'
      });
      jest.spyOn(AulaVirtual, 'findById').mockResolvedValue({
        _id: 'aula101',
        estado: 'abierta',
        expedienteEntregado: true
      });

      await expect(
        estudianteOrchestrator.actualizarCertificado('est123', 'cert101', {
          nombreCurso: 'Curso Modificado'
        })
      ).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining('expediente ya fue entregado')
      });
    });

    it('debe rechazar la actualizacion de formulario pendiente (actualizarFormularioPendiente) con HTTP 403 Forbidden cuando el expediente ya fue entregado y no esta en estado observado', async () => {
      jest.spyOn(AulaVirtual, 'findById').mockResolvedValue({
        _id: 'aula101',
        estudiante: 'est123',
        modalidad: 'laboral',
        expedienteEntregado: true
      });
      jest.spyOn(FormularioPendiente, 'findOne').mockResolvedValue({
        _id: 'form101',
        aulaVirtual: 'aula101',
        estudiante: 'est123',
        estado: 'en_revision'
      });

      await expect(
        estudianteOrchestrator.actualizarFormularioPendiente('aula101', 'est123', {
          entidadReceptora: { nombreEmpresa: 'Intento Empresa' }
        })
      ).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining('expediente ya fue entregado')
      });
    });

    it('debe permitir la actualizacion de formulario pendiente cuando el expediente fue entregado pero su estado es observado', async () => {
      jest.spyOn(AulaVirtual, 'findById').mockResolvedValue({
        _id: 'aula101',
        estudiante: 'est123',
        modalidad: 'laboral',
        expedienteEntregado: true
      });

      const mockFormulario = {
        _id: 'form101',
        aulaVirtual: 'aula101',
        estudiante: 'est123',
        estado: 'observado',
        entidadReceptora: { toObject: () => ({ ruc: '1790012345001' }) },
        horarioSemanal: { toObject: () => ({}) },
        contenidoIa: { toObject: () => ({}) },
        save: jest.fn().mockResolvedValue(true)
      };

      jest.spyOn(FormularioPendiente, 'findOne').mockResolvedValue(mockFormulario);

      const resultado = await estudianteOrchestrator.actualizarFormularioPendiente('aula101', 'est123', {
        entidadReceptora: { razonSocial: 'Empresa Corregida S.A.' }
      });

      expect(mockFormulario.save).toHaveBeenCalledTimes(1);
      expect(resultado.estado).toBe('observado');
      expect(mockFormulario.entidadReceptora.razonSocial).toBe('Empresa Corregida S.A.');
    });
  });

  describe('Validaciones previas para generacion de borrador con IA', () => {
    const entidadCompleta = {
      razonSocial: 'TECH SOLUTIONS S.A.',
      ruc: '1790000000001',
      direccion: 'Av. Amazonas N34-12',
      correo: 'contacto@techsolutions.ec',
      ciudad: 'Quito',
      telefono: '022456789',
      celular: '0998765432',
      tipoEntidad: 'Privada',
      responsable: 'Ing. Carlos Mendoza',
      areaAsignada: 'Sistemas e Innovacion'
    };

    const horarioCompleto = {
      horaInicio: '08:00',
      horaFin: '12:00',
      horasSemanales: 20
    };

    it('debe rechazar con 400 si faltan datos generales en entidadReceptora, creditosAprobados o horarioSemanal', async () => {
      jest.spyOn(AulaVirtual, 'findById').mockResolvedValue({
        _id: 'aula1',
        estudiante: 'est1',
        horasRequeridas: 80,
        modalidad: 'laboral'
      });
      jest.spyOn(FormularioPendiente, 'findOne').mockResolvedValue({
        entidadReceptora: { ...entidadCompleta, ruc: '', direccion: '' },
        creditosAprobados: 90,
        horarioSemanal: horarioCompleto
      });

      await expect(asistenteIaService.generarBorradorInforme('aula1', 'est1')).rejects.toMatchObject({
        statusCode: 400
      });
    });

    it('debe rechazar con 400 si el estudiante aun no completa el 100% de las horas del aula', async () => {
      jest.spyOn(AulaVirtual, 'findById').mockResolvedValue({
        _id: 'aula1',
        estudiante: 'est1',
        horasRequeridas: 80,
        modalidad: 'laboral'
      });
      jest.spyOn(FormularioPendiente, 'findOne').mockResolvedValue({
        entidadReceptora: entidadCompleta,
        creditosAprobados: 90,
        horarioSemanal: horarioCompleto
      });
      jest.spyOn(actividadService, 'calcularHorasAula').mockResolvedValue({
        horasAprobadas: 40,
        cumplioRequisito: false
      });

      await expect(asistenteIaService.generarBorradorInforme('aula1', 'est1')).rejects.toMatchObject({
        statusCode: 400
      });
    });

    it('debe generar el borrador si todos los datos generales estan llenos y las horas estan al 100%', async () => {
      jest.spyOn(AulaVirtual, 'findById').mockResolvedValue({
        _id: 'aula1',
        estudiante: 'est1',
        carrera: 'Desarrollo de Software',
        horasRequeridas: 80,
        modalidad: 'laboral'
      });
      jest.spyOn(FuenteInstitucional, 'find').mockResolvedValue([
        {
          titulo: 'Malla Curricular: Tecnología Superior en Desarrollo de Software (Pénsum 2020)',
          activo: true,
          fragmentos: [
            {
              texto:
                '* **Programación** | Código: `TDSD214` | Créditos: 4\n* **Bases de Datos** | Código: `TDSD224` | Créditos: 4'
            }
          ]
        }
      ]);
      const mockForm = {
        entidadReceptora: entidadCompleta,
        creditosAprobados: 90,
        horarioSemanal: horarioCompleto,
        contenidoIa: {},
        save: jest.fn().mockResolvedValue(true)
      };
      jest.spyOn(FormularioPendiente, 'findOne').mockResolvedValue(mockForm);
      jest.spyOn(actividadService, 'calcularHorasAula').mockResolvedValue({
        horasAprobadas: 80,
        cumplioRequisito: true
      });
      jest.spyOn(ActividadLaboral, 'findOne').mockResolvedValue({
        aulaVirtual: 'aula1',
        actividades: [
          { fecha: new Date('2026-04-06'), descripcion: 'Desarrollo de APIs REST con Express y MongoDB', horas: 80 }
        ]
      });

      const res = await asistenteIaService.generarBorradorInforme('aula1', 'est1');
      expect(res.success).toBe(true);
      expect(res.formulario.totalHoras).toBe(80);
      expect(mockForm.save).toHaveBeenCalledTimes(1);
    });
  });
});
