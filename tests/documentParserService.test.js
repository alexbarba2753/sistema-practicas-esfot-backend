import { documentParserService } from '../src/application/services/documentParserService.js';
import ExcelJS from 'exceljs';

describe('Pruebas del servicio de analisis de documentos normativos (documentParserService)', () => {
  describe('Extraccion y analisis de Carta de Aceptacion (CPP_ESFOT_001)', () => {
    it('debe extraer correctamente horas pactadas, empresa, cedula y cargo', () => {
      const textoCarta = `
        En mi calidad de Gerente General de la empresa TECH SOLUTIONS S.A., a petición de la parte interesada,
        CERTIFICO que el estudiante con cédula de ciudadanía No. 1723456789 realizará sus prácticas preprofesionales
        bajo el cargo de Desarrollador Junior en el área de Sistemas e Innovación con una dedicación de 4 horas diarias,
        completando un total de 80 horas de prácticas laborales.
      `;

      const datos = documentParserService.analizarCartaAceptacion(textoCarta);

      expect(datos.totalHoras).toBe(80);
      expect(datos.horasDiarias).toBe(4);
      expect(datos.cedulaEstudiante).toBe('1723456789');
      expect(datos.razonSocial).toBe('TECH SOLUTIONS S.A.');
      expect(datos.areaAsignada).toBe('Sistemas e Innovación');
      expect(datos.cargoEstudiante).toBe('Desarrollador Junior');
    });

    it('debe retornar valores por defecto si el texto esta vacio o no contiene coincidencias', () => {
      const datos = documentParserService.analizarCartaAceptacion('');
      expect(datos.totalHoras).toBeNull();
      expect(datos.horasDiarias).toBe(8);
      expect(datos.razonSocial).toBe('');
      expect(datos.cedulaEstudiante).toBe('');
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
