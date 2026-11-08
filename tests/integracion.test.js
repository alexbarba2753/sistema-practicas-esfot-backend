import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { adminOrchestrator } from '../src/application/orchestrators/adminOrchestrator.js';
import { estudianteOrchestrator } from '../src/application/orchestrators/estudianteOrchestrator.js';
import { docenteOrchestrator } from '../src/application/orchestrators/docenteOrchestrator.js';
import { aulaService } from '../src/application/services/aulaService.js';
import { actividadService } from '../src/application/services/actividadService.js';
import { convalidacionService } from '../src/application/services/convalidacionService.js';
import { expedienteService } from '../src/application/services/expedienteService.js';
import { asistenteIaService } from '../src/application/services/asistenteIaService.js';
import { excelService } from '../src/application/services/excelService.js';

describe('Pruebas de integracion del flujo completo de practicas preprofesionales', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('debe ejecutar el ciclo de vida completo: creacion de aula -> bitacoras -> convalidacion -> revision docente -> cierre con acta FCP-004 e informe Excel', async () => {
    const adminId = 'usr_admin_001';
    const docenteId = 'usr_docente_002';
    const estudianteId = 'usr_estudiante_003';
    const aulaId = 'aula_practicas_2026';

    // 1. Administrador crea el aula virtual asignando docente y estudiante (relacion 1 a 1)
    jest.spyOn(aulaService, 'crearAula').mockResolvedValue({
      success: true,
      message: 'Aula virtual creada exitosamente con asignacion 1 a 1',
      aula: {
        _id: aulaId,
        nombre: 'Prácticas Laborales - Desarrollo Web',
        periodo: '2026-B',
        modalidad: 'laboral',
        horasRequeridas: 240,
        docenteTutor: docenteId,
        estudiante: estudianteId,
        estado: 'abierta',
        expedienteEntregado: false
      }
    });

    const aulaCreada = await adminOrchestrator.crearAula({
      nombre: 'Prácticas Laborales - Desarrollo Web',
      periodo: '2026-B',
      modalidad: 'laboral',
      horasRequeridas: 240,
      docenteTutor: docenteId,
      estudiante: estudianteId
    });

    expect(aulaCreada.success).toBe(true);
    expect(aulaCreada.aula.estado).toBe('abierta');

    // 2. Estudiante consulta sus aulas asignadas
    jest.spyOn(expedienteService, 'obtenerAulasEstudiante').mockResolvedValue({
      success: true,
      total: 1,
      aulas: [
        {
          _id: aulaId,
          nombre: 'Prácticas Laborales - Desarrollo Web',
          modalidad: 'laboral',
          resumenHoras: {
            horasAprobadas: 0,
            horasRequeridas: 240,
            porcentajeCompletado: 0
          }
        }
      ]
    });

    const misAulas = await estudianteOrchestrator.obtenerAulas(estudianteId);
    expect(misAulas.total).toBe(1);
    expect(misAulas.aulas[0]._id).toBe(aulaId);

    // 3. Estudiante registra actividades laborales en su bitacora
    jest.spyOn(actividadService, 'crearActividadLaboral').mockResolvedValue({
      success: true,
      message: 'Jornada laboral registrada exitosamente en la bitacora',
      actividad: {
        _id: 'act_001',
        aulaVirtual: aulaId,
        horas: 8,
        descripcion: 'Implementacion de servicios backend y esquemas de base de datos',
        estado: 'pendiente'
      }
    });

    const registroActividad = await estudianteOrchestrator.crearActividadLaboral(estudianteId, aulaId, {
      fecha: '2026-10-01',
      horaEntrada: '08:00',
      horaSalida: '16:00',
      descripcion: 'Implementacion de servicios backend y esquemas de base de datos'
    });

    expect(registroActividad.success).toBe(true);
    expect(registroActividad.actividad.horas).toBe(8);

    // 4. Estudiante registra convalidacion de certificacion externa
    jest.spyOn(convalidacionService, 'registrarCertificado').mockResolvedValue({
      success: true,
      message: 'Certificado registrado exitosamente para revision del tutor',
      certificado: {
        _id: 'cert_001',
        nombreCurso: 'Arquitectura de Software y Cloud Computing',
        institucionEmisora: 'Plataforma Especializada',
        horasConvalidadas: 40,
        estado: 'pendiente'
      }
    });

    const registroConvalidacion = await estudianteOrchestrator.registrarCertificado(estudianteId, aulaId, {
      nombreCurso: 'Arquitectura de Software y Cloud Computing',
      institucionEmisora: 'Plataforma Especializada',
      horasCertificado: 60,
      horasConvalidadas: 40,
      urlCertificado: 'https://certificados.org/cert-12345'
    });

    expect(registroConvalidacion.success).toBe(true);
    expect(registroConvalidacion.certificado.horasConvalidadas).toBe(40);

    // 5. Docente tutor revisa y aprueba actividades y convalidaciones
    jest.spyOn(actividadService, 'evaluarActividadLaboral').mockResolvedValue({
      success: true,
      message: 'Actividad evaluada exitosamente',
      actividad: {
        _id: 'act_001',
        estado: 'aprobada',
        evaluadoPor: docenteId
      }
    });

    const evaluacionActividad = await docenteOrchestrator.evaluarActividadLaboral('act_001', docenteId, {
      estado: 'aprobada',
      observacionesDocente: 'Cumple con los requerimientos tecnicos previstos.'
    });

    expect(evaluacionActividad.success).toBe(true);
    expect(evaluacionActividad.actividad.estado).toBe('aprobada');

    jest.spyOn(convalidacionService, 'evaluarCertificado').mockResolvedValue({
      success: true,
      message: 'Certificado de convalidacion aprobado satisfactoriamente',
      certificado: {
        _id: 'cert_001',
        estado: 'aprobado',
        horasConvalidadas: 40
      }
    });

    const evaluacionCertificado = await docenteOrchestrator.evaluarConvalidacion('cert_001', {
      estado: 'aprobado',
      observacion: 'Contenido pertinente a la malla curricular.'
    });

    expect(evaluacionCertificado.success).toBe(true);
    expect(evaluacionCertificado.certificado.estado).toBe('aprobado');

    // 6. Estudiante genera borrador del informe asistido por IA y entrega el expediente
    jest.spyOn(asistenteIaService, 'generarBorradorInforme').mockResolvedValue({
      success: true,
      message: 'Borrador del informe generado exitosamente con el contenido tecnico de la bitacora',
      formulario: {
        aulaVirtual: aulaId,
        totalHoras: 240,
        estado: 'borrador'
      }
    });

    const borradorInforme = await estudianteOrchestrator.generarBorradorInforme(aulaId, estudianteId);
    expect(borradorInforme.success).toBe(true);

    jest.spyOn(expedienteService, 'entregarExpediente').mockResolvedValue({
      success: true,
      message: 'Expediente de practicas entregado formalmente al docente tutor para su aprobacion',
      fechaEntrega: new Date()
    });

    const entrega = await estudianteOrchestrator.entregarExpediente(aulaId, estudianteId);
    expect(entrega.success).toBe(true);

    // 7. Docente tutor cierra la practica formalmente con calificacion y emision de Acta FCP-004
    jest.spyOn(expedienteService, 'cerrarProcesoDocente').mockResolvedValue({
      success: true,
      message: 'Practica aprobada y cerrada formalmente. Acta FCP-004 emitida.',
      actaAprobacion: {
        aulaVirtual: aulaId,
        docenteTutor: docenteId,
        dictamen: 'Aprobado',
        calificacionTutor: 20,
        estado: 'aprobado'
      },
      aulaEstado: 'cerrada'
    });

    const cierre = await docenteOrchestrator.cerrarPractica(aulaId, docenteId, {
      dictamen: 'Aprobado',
      calificacion: 20,
      observacionesFinales: 'Desempeño destacado en el cumplimiento de las prácticas preprofesionales.'
    });

    expect(cierre.success).toBe(true);
    expect(cierre.actaAprobacion.dictamen).toBe('Aprobado');
    expect(cierre.actaAprobacion.calificacionTutor).toBe(20);
    expect(cierre.aulaEstado).toBe('cerrada');

    // 8. Generacion y descarga del informe oficial en Excel
    jest.spyOn(expedienteService, 'descargarInformeExcel').mockResolvedValue({
      buffer: Buffer.from('contenido_excel_mock_f_aa_119'),
      filename: 'F_AA_119_Informe_Practicas_Laborales_1723456789.xlsx'
    });

    const reporteEstudiante = await estudianteOrchestrator.descargarInforme(aulaId, estudianteId);
    expect(reporteEstudiante.filename).toContain('F_AA_119');
    expect(reporteEstudiante.buffer).toBeDefined();

    const reporteDocente = await docenteOrchestrator.descargarInforme(aulaId, docenteId);
    expect(reporteDocente.filename).toContain('F_AA_119');
    expect(reporteDocente.buffer).toBeDefined();
  });
});
