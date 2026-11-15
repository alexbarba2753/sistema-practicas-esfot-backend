import { jest } from '@jest/globals';
import { documentParserService } from '../src/application/services/documentParserService.js';
import ExcelJS from 'exceljs';

describe('Pruebas del servicio de analisis de documentos normativos (documentParserService)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Extraccion y analisis de Carta de Aceptacion (CPP_ESFOT_001)', () => {
    it('debe extraer correctamente horas pactadas, empresa, cedula, cargo, fechas y actividades', () => {
      const textoCarta = `
        Yo, Carlos Mendoza, en mi calidad de Gerente General de TECH SOLUTIONS S.A., a petición verbal de la interesada:
        CERTIFICO:
        Que, el señor Juan Perez con cédula de identidad No. 172345678-9 realizará prácticas pre-profesionales
        de la carrera de Tecnología Superior en Desarrollo de Software en TECH SOLUTIONS S.A.,
        desde el 1 de abril hasta el 31 de mayo de 2026. Realizará las tareas bajo el cargo de Desarrollador Junior,
        en el área de Sistemas e Innovación con una dedicación de 4 horas diarias, completando un total de 80 horas.
        Las actividades que se tiene previsto que realizará el estudiante durante las prácticas serán:
        - Desarrollo de endpoints REST en Node.js
        - Pruebas unitarias con Jest
        Atentamente,
      `;

      const datos = documentParserService.analizarCartaAceptacion(textoCarta);

      expect(datos.esCartaAceptacion).toBe(true);
      expect(datos.totalHoras).toBe(80);
      expect(datos.horasDiarias).toBe(4);
      expect(datos.cedulaEstudiante).toBe('1723456789');
      expect(datos.razonSocial).toBe('TECH SOLUTIONS S.A.');
      expect(datos.areaAsignada).toBe('Sistemas e Innovación');
      expect(datos.cargoEstudiante).toBe('Desarrollador Junior');
      expect(datos.fechaInicio.toISOString().split('T')[0]).toBe('2026-04-01');
      expect(datos.fechaFin.toISOString().split('T')[0]).toBe('2026-05-31');
      expect(datos.actividadesPrevistas).toHaveLength(2);
    });

    it('debe retornar valores por defecto si el texto esta vacio o no contiene coincidencias', () => {
      const datos = documentParserService.analizarCartaAceptacion('');
      expect(datos.totalHoras).toBeNull();
      expect(datos.horasDiarias).toBe(8);
      expect(datos.razonSocial).toBe('');
      expect(datos.cedulaEstudiante).toBe('');
    });
  });

  describe('Analisis de Solicitud de Practicas (FP-001)', () => {
    it('debe extraer estudiante, cedula, empresa receptora y periodo', () => {
      const textoSolicitud = `
        Por medio del presente, yo Juan Perez, con cédula de ciudadanía Nº 1723456789,
        estudiante de la carrera Tecnología Superior en Desarrollo de Software, solicito a Usted autorizar
        la ejecución de las prácticas pre-profesionales laborales:

        INSTITUCIÓN / EMPRESA RECEPTORA: TECH SOLUTIONS S.A.
        PERÍODO: 1 de abril hasta el 31 de mayo de 2026.
      `;

      const datos = documentParserService.analizarSolicitudPracticas(textoSolicitud);

      expect(datos.esSolicitudPracticas).toBe(true);
      expect(datos.cedulaEstudiante).toBe('1723456789');
      expect(datos.razonSocial).toBe('TECH SOLUTIONS S.A.');
      expect(datos.fechaInicio.toISOString().split('T')[0]).toBe('2026-04-01');
      expect(datos.fechaFin.toISOString().split('T')[0]).toBe('2026-05-31');
    });
  });

  describe('Validacion cruzada de ambos PDFs obligatorios para creacion de aula', () => {
    const textoCartaValida = `
      Yo, Carlos Mendoza, en mi calidad de Gerente General de TECH SOLUTIONS S.A., a petición verbal del interesado:
      CERTIFICO:
      Que, el señor Juan Perez con cédula de identidad No. 1723456789 realizará prácticas pre-profesionales
      de la carrera de Tecnología Superior en Desarrollo de Software en TECH SOLUTIONS S.A.,
      desde el 1 de abril hasta el 31 de mayo de 2026. Realizará las tareas bajo el cargo de Desarrollador Junior,
      en el área de Desarrollo Web con una dedicación de 4 horas diarias, completando un total de 80 horas.
      Las actividades que se tiene previsto que realizará el estudiante durante las prácticas serán:
      - Desarrollo de modulos backend en Express
      Atentamente,
    `;

    const textoSolicitudValida = `
      Por medio del presente, yo Juan Perez, con cédula de ciudadanía Nº 1723456789, solicito a Usted autorizar
      la ejecución de las prácticas pre-profesionales laborales:
      INSTITUCIÓN / EMPRESA RECEPTORA: TECH SOLUTIONS S.A.
      PERÍODO: 1 de abril hasta el 31 de mayo de 2026.
    `;

    const pdfCarta = { originalname: 'carta.pdf', mimetype: 'application/pdf', buffer: Buffer.from('pdf-carta') };
    const pdfSolicitud = { originalname: 'solicitud.pdf', mimetype: 'application/pdf', buffer: Buffer.from('pdf-solicitud') };
    const estudianteDb = { cedula: '1723456789' };

    it('debe rechazar si falta alguno de los dos PDFs o no tienen extension/mimetype PDF', async () => {
      await expect(
        documentParserService.validarDocumentosCreacionAula(null, pdfSolicitud, estudianteDb)
      ).rejects.toThrow('cartaAceptacion');

      await expect(
        documentParserService.validarDocumentosCreacionAula(
          { originalname: 'carta.docx', mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from('x') },
          pdfSolicitud,
          estudianteDb
        )
      ).rejects.toThrow('formato PDF');
    });

    it('debe aprobar cuando ambos PDFs estan llenos y concuerdan en cedula, fechas y empresa', async () => {
      jest
        .spyOn(documentParserService, 'extraerTexto')
        .mockResolvedValueOnce(textoCartaValida)
        .mockResolvedValueOnce(textoSolicitudValida);

      const res = await documentParserService.validarDocumentosCreacionAula(pdfCarta, pdfSolicitud, estudianteDb);

      expect(res.carta.totalHoras).toBe(80);
      expect(res.carta.razonSocial).toBe('TECH SOLUTIONS S.A.');
      expect(res.solicitud.cedulaEstudiante).toBe('1723456789');
    });

    it('debe rechazar si las fechas entre carta y solicitud no coinciden', async () => {
      const solicitudOtraFecha = textoSolicitudValida.replace('31 de mayo de 2026', '15 de junio de 2026');
      jest
        .spyOn(documentParserService, 'extraerTexto')
        .mockResolvedValueOnce(textoCartaValida)
        .mockResolvedValueOnce(solicitudOtraFecha);

      await expect(
        documentParserService.validarDocumentosCreacionAula(pdfCarta, pdfSolicitud, estudianteDb)
      ).rejects.toThrow('no coinciden');
    });

    it('debe rechazar si aun contiene placeholders de la plantilla sin llenar', async () => {
      const cartaConPlaceholder = textoCartaValida.replace('TECH SOLUTIONS S.A.', '(nombre de la empresa)');
      jest
        .spyOn(documentParserService, 'extraerTexto')
        .mockResolvedValueOnce(cartaConPlaceholder)
        .mockResolvedValueOnce(textoSolicitudValida);

      await expect(
        documentParserService.validarDocumentosCreacionAula(pdfCarta, pdfSolicitud, estudianteDb)
      ).rejects.toThrow('sin llenar');
    });
  });

  describe('Extraccion de texto generico', () => {
    it('debe lanzar error 400 si el buffer esta vacio', async () => {
      await expect(documentParserService.extraerTexto(null, 'test.pdf')).rejects.toThrow(
        'El archivo proporcionado se encuentra vacio'
      );
    });

    it('debe extraer texto plano correctamente', async () => {
      const buffer = Buffer.from('Contenido de prueba normativo');
      const resultado = await documentParserService.extraerTexto(buffer, 'norma.txt');
      expect(resultado).toBe('Contenido de prueba normativo');
    });
  });

  describe('Validacion de formulario Excel FCP-001A', () => {
    it('debe rechazar con error 400 si faltan campos obligatorios en el Excel', async () => {
      const workbook = new ExcelJS.Workbook();
      workbook.addWorksheet('FORMULARIO');
      const buffer = await workbook.xlsx.writeBuffer();

      await expect(documentParserService.validarYProcesarExcelFcp001a(buffer)).rejects.toThrow(
        'El formulario Excel FCP-001A tiene campos obligatorios incompletos'
      );
    });

    it('debe extraer datos correctamente si el Excel contiene la informacion requerida', async () => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('FORMULARIO');
      sheet.getCell('C26').value = 'Juan Perez';
      sheet.getCell('C27').value = '1721234567';
      sheet.getCell('C28').value = 'juan.perez@epn.edu.ec';
      sheet.getCell('C34').value = 'Empresa Publica EPN Tech';
      sheet.getCell('C59').value = 120;

      const buffer = await workbook.xlsx.writeBuffer();
      const resultado = await documentParserService.validarYProcesarExcelFcp001a(buffer);

      expect(resultado.success).toBe(true);
      expect(resultado.estudianteNombre).toBe('Juan Perez');
      expect(resultado.cedula).toBe('1721234567');
      expect(resultado.razonSocial).toBe('Empresa Publica EPN Tech');
      expect(resultado.horasSolicitadas).toBe(120);
    });
  });
});
