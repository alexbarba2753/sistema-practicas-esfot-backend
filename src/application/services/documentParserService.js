import mammoth from 'mammoth';
import { createRequire } from 'module';
import ExcelJS from 'exceljs';
import { errorHttp } from '../../domain/utils/errorHttp.js';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

export const documentParserService = {
  // Extrae texto plano a partir de un archivo Word (.docx), PDF o Excel
  async extraerTexto(buffer, nombreArchivo, mimeType = '') {
    if (!buffer || buffer.length === 0) {
      throw errorHttp('El archivo proporcionado se encuentra vacio', 400);
    }

    const nombreMin = (nombreArchivo || '').toLowerCase();

    if (nombreMin.endsWith('.docx') || mimeType.includes('wordprocessingml')) {
      const resultado = await mammoth.extractRawText({ buffer });
      return resultado.value || '';
    }

    if (nombreMin.endsWith('.pdf') || mimeType.includes('pdf')) {
      const data = await pdfParse(buffer);
      return data.text || '';
    }

    if (nombreMin.endsWith('.xlsx') || nombreMin.endsWith('.xlsm') || mimeType.includes('spreadsheetml')) {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      let textoCompleto = '';
      workbook.eachSheet((worksheet) => {
        worksheet.eachRow((row) => {
          const valoresFila = row.values
            .filter((v) => v !== undefined && v !== null)
            .map((v) => (typeof v === 'object' && v.text ? v.text : String(v)))
            .join(' | ');
          if (valoresFila) textoCompleto += valoresFila + '\n';
        });
      });
      return textoCompleto;
    }

    // Si es texto plano o markdown
    return buffer.toString('utf-8');
  },

  // Analiza la Carta de Aceptación (CPP_ESFOT_001) para extraer datos empresariales y horas pactadas
  analizarCartaAceptacion(texto) {
    const datos = {
      razonSocial: '',
      responsable: '',
      cargoResponsable: '',
      areaAsignada: '',
      cargoEstudiante: '',
      horasDiarias: 8,
      totalHoras: null,
      fechaInicio: null,
      fechaFin: null,
      cedulaEstudiante: '',
      nombreEstudiante: '',
      actividadesPrevistas: []
    };

    if (!texto) return datos;

    // 1. Extraer horas totales pactadas: "completando un total de (##) horas" o "total de 50 horas"
    const regexTotalHoras = /(?:completando un total de|total de|por un total de|un total de)\s*(\d+)\s*horas/i;
    const matchTotalHoras = texto.match(regexTotalHoras);
    if (matchTotalHoras && matchTotalHoras[1]) {
      datos.totalHoras = parseInt(matchTotalHoras[1], 10);
    } else {
      // Buscar cualquier número seguido de "horas"
      const matchGeneralHoras = /(\d+)\s*(?:horas|h)\s*(?:de prácticas|de duraci[oó]n|en total)/i;
      const mg = texto.match(matchGeneralHoras);
      if (mg && mg[1]) datos.totalHoras = parseInt(mg[1], 10);
    }

    // 2. Extraer horas diarias: "dedicación de (##) horas diarias"
    const regexHorasDiarias = /dedicaci[oó]n de\s*(\d+)\s*horas diarias/i;
    const matchHorasDiarias = texto.match(regexHorasDiarias);
    if (matchHorasDiarias && matchHorasDiarias[1]) {
      datos.horasDiarias = Math.min(8, parseInt(matchHorasDiarias[1], 10));
    }

    // 3. Extraer cédula de estudiante
    const regexCedula = /(?:c[eé]dula(?: de identidad| de ciudadan[ií]a)?\s*(?:No\.|N[°º]|#)?\s*)(\d{9,10}[-\d]?)/i;
    const matchCedula = texto.match(regexCedula);
    if (matchCedula && matchCedula[1]) {
      datos.cedulaEstudiante = matchCedula[1].replace('-', '');
    }

    // 4. Extraer empresa: "en mi calidad de ... de (nombre de la empresa)" o "en (nombre de la empresa)"
    const regexEmpresa = /(?:de la empresa|en la empresa|de la instituci[oó]n)\s+([A-Z0-9\s.,&'-]{3,50})(?:,|\.|\ba petici[oó]n|\bCERTIFICO)/i;
    const matchEmpresa = texto.match(regexEmpresa);
    if (matchEmpresa && matchEmpresa[1]) {
      datos.razonSocial = matchEmpresa[1].replace(/,\s*$/, '').trim();
    }

    // 5. Extraer área asignada: "en el área de (nombre del área)"
    const regexArea = /en el [aá]rea de\s+([A-Za-z0-9áéíóúÁÉÍÓÚñÑ\s/_-]{3,40})(?:,|\.|\bcon una dedicaci[oó]n)/i;
    const matchArea = texto.match(regexArea);
    if (matchArea && matchArea[1]) {
      datos.areaAsignada = matchArea[1].replace(/,\s*$/, '').trim();
    }

    // 6. Extraer cargo de estudiante: "bajo el cargo de (cargo del estudiante)"
    const regexCargo = /bajo el cargo de\s+([A-Za-z0-9áéíóúÁÉÍÓÚñÑ\s/_-]{3,40})(?:,|\.|\ben el [aá]rea)/i;
    const matchCargo = texto.match(regexCargo);
    if (matchCargo && matchCargo[1]) {
      datos.cargoEstudiante = matchCargo[1].replace(/,\s*$/, '').trim();
    }

    return datos;
  },

  // Valida y extrae datos del formulario Excel FCP_001A para convalidación
  async validarYProcesarExcelFcp001a(buffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const worksheet = workbook.getWorksheet('FORMULARIO') || workbook.worksheets[0];
    if (!worksheet) {
      throw errorHttp('El archivo Excel no contiene una hoja valida para procesar el formulario FCP-001A', 400);
    }

    // Lectura de celdas estandar de la version oficial FCP_001A
    const razonSocial = (worksheet.getCell('C34').text || worksheet.getCell('C35').text || '').trim();
    const estudianteNombre = (worksheet.getCell('C26').text || worksheet.getCell('C27').text || '').trim();
    const cedula = (worksheet.getCell('C27').text || worksheet.getCell('C28').text || '').trim();
    const correo = (worksheet.getCell('C28').text || '').trim();
    const horasSolicitadasRaw = worksheet.getCell('C59').value || worksheet.getCell('F74').value;
    const horasSolicitadas = Number(horasSolicitadasRaw) || 0;

    const camposFaltantes = [];
    if (!estudianteNombre) camposFaltantes.push('Nombres del estudiante (Sección 3)');
    if (!cedula) camposFaltantes.push('Cédula de identidad (Sección 3)');
    if (!razonSocial) camposFaltantes.push('Institución o Empresa receptora (Sección 5)');

    if (camposFaltantes.length > 0) {
      throw errorHttp(
        `El formulario Excel FCP-001A tiene campos obligatorios incompletos: ${camposFaltantes.join(', ')}`,
        400
      );
    }

    return {
      success: true,
      estudianteNombre,
      cedula,
      correo,
      razonSocial,
      horasSolicitadas: horasSolicitadas > 0 ? horasSolicitadas : 96
    };
  }
};
