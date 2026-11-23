import { jest, describe, it, expect, afterEach } from '@jest/globals';
import ExcelJS from 'exceljs';
import { adminOrchestrator } from '../src/application/orchestrators/adminOrchestrator.js';
import { estudianteOrchestrator } from '../src/application/orchestrators/estudianteOrchestrator.js';
import { docenteOrchestrator } from '../src/application/orchestrators/docenteOrchestrator.js';
import { aulaService } from '../src/application/services/aulaService.js';
import { expedienteService } from '../src/application/services/expedienteService.js';
import { excelService } from '../src/application/services/excelService.js';
import { documentParserService } from '../src/application/services/documentParserService.js';
import { Usuario } from '../src/infrastructure/database/models/Usuario.js';
import { AulaVirtual } from '../src/infrastructure/database/models/AulaVirtual.js';
import { AulaConvalidacion } from '../src/infrastructure/database/models/AulaConvalidacion.js';
import { FormularioPendiente } from '../src/infrastructure/database/models/FormularioPendiente.js';
import { FormularioAprobacion } from '../src/infrastructure/database/models/FormularioAprobacion.js';
import { FuenteInstitucional } from '../src/infrastructure/database/models/FuenteInstitucional.js';

describe('Flujo completo de aulas temporales de Convalidacion (FCP_001A + Certificado PDF)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('debe permitir crear multiples aulas de convalidacion para un mismo estudiante validando Excel y certificado', async () => {
    const tutor = { _id: 'doc1', rol: 'docente' };
    const alumno = { _id: 'est1', rol: 'estudiante', nombres: 'Iván Andrés', apellidos: 'Panchi Chávez', cedula: '1754768990' };

    jest.spyOn(Usuario, 'findById').mockImplementation(async (id) => (id === 'doc1' ? tutor : alumno));
    jest.spyOn(documentParserService, 'validarDocumentosConvalidacion').mockResolvedValue({
      datosExcel: {
        seccion1y2Marcas: ['A14'],
        estudianteNombre: 'Iván Andrés Panchi Chávez',
        cedula: '1754768990',
        correo: 'ivan.panchi@epn.edu.ec',
        documentacionSoporte: 'Se adjunta certificado PDF.',
        razonSocial: 'Udemy',
        ruc: 'N/A',
        direccion: '600 Harrison St',
        ciudad: 'Estados Unidos',
        telefonoInst: 'N/A',
        celularInst: 'N/A',
        correoInst: 'N/A',
        tipoInstitucion: 'ORGANISMO INTERNACIONAL',
        campoAmplio: 'EDUCACION',
        campoEspecifico: 'Educación',
        codigoProyecto: 'N/A',
        nombreProyecto: 'N/A',
        resumenActividades: 'Curso HTML y CSS.',
        contribucionConocimientos: 'Aporta al desarrollo web.',
        resultadosAprendizaje: 'Interfaces web.',
        asignaturasMalla: 'Desarrollo de Aplicaciones Web (TDSD414).',
        fechaInicio: new Date('2025-10-15T00:00:00Z'),
        fechaFin: new Date('2025-10-15T00:00:00Z'),
        horasSolicitadas: 3.5,
        fechaDeclaracion: new Date('2026-01-19T00:00:00Z')
      },
      textoCertificado: 'CERTIFICADO ANDRES PANCHI 3.5 horas',
      certificadoAnalisis: { horasMaximas: 3.5 }
    });

    jest.spyOn(AulaConvalidacion.prototype, 'save').mockResolvedValue(true);
    jest.spyOn(FormularioPendiente, 'findOneAndUpdate').mockResolvedValue({ _id: 'formConv1' });
    jest.spyOn(aulaService, 'obtenerAulaPorId').mockResolvedValue({
      _id: 'convAula1',
      nombre: 'Convalidación Curso HTML',
      modalidad: 'laboral',
      horasRequeridas: 3.5
    });

    const archivos = {
      formularioFcp001a: [{ originalname: 'fcp.xlsx', mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('x') }],
      certificado: [{ originalname: 'cert.pdf', mimetype: 'application/pdf', buffer: Buffer.from('y') }]
    };

    const res1 = await adminOrchestrator.crearAulaConvalidacion(
      { nombre: 'Convalidación Curso HTML', periodo: '2026-B', modalidad: 'laboral', carrera: 'Desarrollo de Software', docenteTutor: 'doc1', estudiante: 'est1' },
      archivos
    );
    const res2 = await adminOrchestrator.crearAulaConvalidacion(
      { nombre: 'Convalidación Curso PHP', periodo: '2026-B', modalidad: 'laboral', carrera: 'Desarrollo de Software', docenteTutor: 'doc1', estudiante: 'est1' },
      archivos
    );

    expect(res1._id).toBe('convAula1');
    expect(res2.horasRequeridas).toBe(3.5);
  });

  it('debe mejorar la Seccion 6 con IA usando el borrador del estudiante y el certificado PDF', async () => {
    jest.spyOn(AulaConvalidacion, 'findById').mockResolvedValue({
      _id: 'convAula1',
      estudiante: 'est1',
      modalidad: 'laboral',
      carrera: 'Desarrollo de Software',
      horasRequeridas: 12,
      expedienteEntregado: false,
      datosInstitucion: { razonSocial: 'Platzi' },
      certificadoPdf: { textoExtraido: 'Platzi certifica a ANDRES PANCHI curso de WINDSURF 12 horas de teoria y practica' }
    });

    const mockFormulario = {
      _id: 'formConv1',
      aulaVirtual: 'convAula1',
      estado: 'borrador',
      entidadReceptora: { razonSocial: 'Platzi' },
      contenidoIa: {
        resumenActividades: 'Curso de Windsurf AI y uso de Cascade.',
        contribucionConocimientos: 'Fortalecio competencias digitales.',
        resultadosAprendizaje: 'Uso de IA en desarrollo de software.',
        asignaturasMalla: 'Programacion (TDSD214).'
      },
      save: jest.fn().mockResolvedValue(true)
    };
    jest.spyOn(FormularioPendiente, 'findOne').mockResolvedValue(mockFormulario);
    jest.spyOn(FuenteInstitucional, 'find').mockResolvedValue([]);

    const res = await estudianteOrchestrator.mejorarFormularioConvalidacionIA('convAula1', 'est1');

    expect(res.success).toBe(true);
    expect(mockFormulario.contenidoIa.resumenActividades.length).toBeGreaterThan(40);
    expect(mockFormulario.contenidoIa.contribucionConocimientos).toMatch(/desarrollo de software/i);
    expect(mockFormulario.save).toHaveBeenCalledTimes(1);
  });

  it('debe entregar expediente, completar Seccion 9 por docente, aprobar y mover a formularios_aprobados por admin', async () => {
    const aulaDoc = {
      _id: 'convAula1',
      estudiante: 'est1',
      docenteTutor: 'doc1',
      modalidad: 'comunitario',
      horasRequeridas: 96,
      estado: 'abierta',
      expedienteEntregado: false,
      save: jest.fn().mockResolvedValue(true)
    };
    const formDoc = {
      _id: 'formConv1',
      aulaVirtual: 'convAula1',
      estudiante: 'est1',
      modalidad: 'comunitario',
      tipoAula: 'convalidacion',
      totalHoras: 96,
      estado: 'borrador',
      seguimientoTutor: {},
      toObject: function () { return { ...this }; },
      save: jest.fn().mockResolvedValue(true)
    };

    jest.spyOn(AulaVirtual, 'findById').mockResolvedValue(null);
    jest.spyOn(AulaVirtual, 'findOne').mockResolvedValue(null);
    jest.spyOn(AulaConvalidacion, 'findById').mockResolvedValue(aulaDoc);
    jest.spyOn(AulaConvalidacion, 'findOne').mockResolvedValue(aulaDoc);
    jest.spyOn(FormularioPendiente, 'findOne').mockResolvedValue(formDoc);

    // 1. Estudiante entrega expediente sin bitacoras diarias
    const entrega = await estudianteOrchestrator.entregarExpediente('convAula1', 'est1');
    expect(entrega.success).toBe(true);
    expect(aulaDoc.expedienteEntregado).toBe(true);
    expect(formDoc.estado).toBe('en_revision');

    // 2. Docente no puede aprobar antes de completar Seccion 9
    await expect(
      docenteOrchestrator.cerrarPractica('convAula1', 'doc1', { dictamen: 'Aprobado' })
    ).rejects.toThrow('Seccion 9');

    // 3. Docente completa Seccion 9
    const evalSec9 = await docenteOrchestrator.evaluarSeguimientoDocente('convAula1', 'doc1', {
      unidadAcademica: 'ESFOT',
      contribuyoConocimientos: true,
      contribuyoResultadosAprendizaje: true,
      validoActividades: true,
      analisisRecomendaciones: 'Certificado verificado correctamente.',
      horasValidadasSugeridas: 96
    });
    expect(evalSec9.success).toBe(true);
    expect(formDoc.seguimientoTutor.completadoPorTutor).toBe(true);
    expect(formDoc.estado).toBe('pendiente_comision');

    // 4. Docente aprueba y pasa a comision
    const aprobDocente = await docenteOrchestrator.cerrarPractica('convAula1', 'doc1', { dictamen: 'Aprobado' });
    expect(aprobDocente.success).toBe(true);
    expect(formDoc.estado).toBe('aprobado_docente');

    // 5. Admin da veredicto final, mueve a formularios_aprobados y cierra aula
    jest.spyOn(FormularioAprobacion, 'findOneAndUpdate').mockResolvedValue({ ...formDoc, estado: 'aprobado' });
    jest.spyOn(FormularioPendiente, 'deleteOne').mockResolvedValue({ deletedCount: 1 });

    const dictamenAdmin = await adminOrchestrator.dictamenFinalComision('convAula1', 'admin1', {
      dictamen: 'Aprobado',
      observaciones: 'Convalidacion aprobada por la CPP.'
    });

    expect(dictamenAdmin.success).toBe(true);
    expect(dictamenAdmin.aulaEstado).toBe('cerrada');
    expect(FormularioAprobacion.findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(FormularioPendiente.deleteOne).toHaveBeenCalledWith({ _id: 'formConv1' });
  });

  it('debe generar el Excel FCP_001A desde plantilla limpia copiando secciones 1-10', async () => {
    const { buffer, filename } = await excelService.generarExcelInformeConvalidacionFcp001a({
      aula: {
        carrera: '(RRA) Tecnología Superior en Desarrollo de Software',
        modalidad: 'laboral',
        fechaInicio: new Date('2025-12-26T00:00:00Z'),
        fechaFin: new Date('2025-12-26T00:00:00Z'),
        horasRequeridas: 12
      },
      estudiante: {
        nombres: 'Iván Andrés',
        apellidos: 'Panchi Chávez',
        cedula: '1754768990',
        correo: 'ivan.panchi@epn.edu.ec',
        telefono: '0985510920'
      },
      docente: {
        nombres: 'Lorena Elizabeth',
        apellidos: 'Chulde Obando'
      },
      formularioPendiente: {
        seccion1y2Marcas: ['A14'],
        documentacionSoporte: 'Se adjunta certificado Windsurf en PDF.',
        totalHoras: 12,
        entidadReceptora: {
          razonSocial: 'Platzi',
          ruc: 'N/A',
          direccion: 'Carrera 7 #71-21',
          ciudad: 'Bogotá, Colombia',
          telefono: 'N/A',
          celular: 'N/A',
          correo: 'N/A',
          tipoEntidad: 'ORGANISMO INTERNACIONAL',
          campoAmplio: 'EDUCACION',
          campoEspecifico: 'Educación',
          codigoProyecto: 'N/A',
          nombreProyecto: 'N/A'
        },
        contenidoIa: {
          resumenActividades: 'Resumen mejorado con IA.',
          contribucionConocimientos: 'Contribucion mejorada.',
          resultadosAprendizaje: 'Resultados mejorados.',
          asignaturasMalla: 'Programación (TDSD214).'
        },
        seguimientoTutor: {
          completadoPorTutor: true,
          unidadAcademica: 'ESFOT',
          observacionesPlan: 'Validado por tutor EPN.',
          horasValidadasSugeridas: 12,
          evaluacionCualitativaTutor: {
            recomiendaEntidad: true,
            aportaPerfilEgreso: true,
            recomiendaAprobacion: true
          }
        },
        resolucionComision: {
          avalaAprobacion: true,
          horasAprobadasLaborales: 12,
          observacionesComision: 'Aprobado en sesion CPP.'
        }
      }
    });

    expect(filename).toBe('FCP_001A_Convalidacion_Laboral_1754768990.xlsx');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const ws = wb.getWorksheet('FORMULARIO');
    expect(ws.getCell('A14').value).toBe('X');
    expect(ws.getCell('C26').value).toBe('Iván Andrés Panchi Chávez');
    expect(ws.getCell('C34').value).toBe('Platzi');
    expect(ws.getCell('A48').value).toBe('Resumen mejorado con IA.');
    expect(ws.getCell('C59').value).toBe(12);
    expect(ws.getCell('B68').value).toBe('Lorena Elizabeth Chulde Obando');
    expect(ws.getCell('H69').value).toBe('X');
    expect(ws.getCell('A73').value).toBe('Validado por tutor EPN.');
    expect(ws.getCell('E74').value).toBe(12);
    expect(ws.getCell('C78').value).toBe(12);
    expect(ws.getCell('C79').value).toBe('Aprobado en sesion CPP.');
  });
});
