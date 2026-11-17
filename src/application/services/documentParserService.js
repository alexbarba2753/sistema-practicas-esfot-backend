import mammoth from 'mammoth';
import { createRequire } from 'module';
import ExcelJS from 'exceljs';
import { createWorker } from 'tesseract.js';
import { errorHttp } from '../../domain/utils/errorHttp.js';

const require = createRequire(import.meta.url);
const pdfParseModule = require('pdf-parse');

const MESES_ES = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  setiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11
};

const PLACEHOLDERS_PLANTILLA = [
  '(nombres y apellidos completos)',
  '(#########-#)',
  '(##)',
  '(nombre de la empresa)',
  '(nombre de la carrera)',
  '(fecha de inicio y fecha fin',
  '(cargo del estudiante)',
  '(nombre del area)',
  '(nombre del área)',
  '(institucion o empresa donde se ejecutaran',
  '(institución o empresa donde se ejecutarán',
  '(nombre y apellido del estudiante)',
  '(n° cedula de ciudadania)',
  '(nº cédula de ciudadanía)',
  '1 de abril hasta el 31 de mayo de 2015',
  '1 de abril hasta el 31 de mayo de 2024'
];

function normalizarSinTildes(texto = '') {
  return String(texto)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function normalizarCedula(cedula = '') {
  return String(cedula).replace(/[-\s]/g, '').trim();
}

function normalizarEmpresa(nombre = '') {
  return normalizarSinTildes(nombre)
    .replace(/[.,;:'"()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function obtenerTextoCelda(worksheet, ref) {
  const cell = worksheet.getCell(ref);
  if (!cell) return '';
  const val = cell.value;
  if (val === null || val === undefined) return '';
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'object') {
    if (Array.isArray(val.richText)) {
      return val.richText.map((r) => r.text || '').join('').trim();
    }
    if (val.result !== undefined && val.result !== null) {
      return val.result instanceof Date ? val.result.toISOString() : String(val.result).trim();
    }
    if (val.text) return String(val.text).trim();
  }
  return String(cell.text ?? val).trim();
}

function parsearFechaCelda(worksheet, ref) {
  const cell = worksheet.getCell(ref);
  if (!cell || cell.value === null || cell.value === undefined) return null;
  const val = cell.value;
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val;
  }
  if (typeof val === 'object' && val.result instanceof Date && !isNaN(val.result.getTime())) {
    return val.result;
  }
  const texto = obtenerTextoCelda(worksheet, ref);
  if (!texto || /^dd\/mm\/aaaa$/i.test(texto)) return null;
  const parsed = parsearFechaIndividual(texto);
  if (parsed) return parsed;
  const fallback = new Date(texto);
  return isNaN(fallback.getTime()) ? null : fallback;
}

function extraerNumeroHorasTexto(texto = '') {
  const limpio = String(texto).replace(',', '.');
  const match = limpio.match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : 0;
}

function coincidenNombresPorTokens(nombreA = '', nombreB = '') {
  const tokensA = normalizarSinTildes(nombreA)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3);
  const textoBNorm = normalizarSinTildes(nombreB).replace(/[^a-z0-9\s]/g, ' ');
  if (tokensA.length === 0 || !textoBNorm.trim()) return false;
  let coincidencias = 0;
  for (const token of tokensA) {
    if (textoBNorm.includes(token)) coincidencias++;
  }
  return coincidencias >= Math.min(2, tokensA.length);
}

async function aplicarOcrPdf(parser, maxPaginas = 4) {
  const ss = await parser.getScreenshot({ scale: 1.5 });
  const paginas = (ss?.pages || []).slice(0, maxPaginas);
  if (paginas.length === 0) return '';

  const worker = await createWorker('spa+eng');
  try {
    await worker.setParameters({ tessedit_pageseg_mode: '11' });
    const textos = [];
    for (const pagina of paginas) {
      if (!pagina?.data) continue;
      const res = await worker.recognize(Buffer.from(pagina.data));
      if (res?.data?.text) textos.push(res.data.text);
    }
    return textos.join('\n').trim();
  } finally {
    await worker.terminate();
  }
}

function parsearFechaIndividual(textoFecha, anioPorDefecto = null) {
  if (!textoFecha) return null;
  const limpio = normalizarSinTildes(textoFecha).replace(/\b(el|del)\b/g, ' ').replace(/\s+/g, ' ').trim();

  // Formato ISO YYYY-MM-DD
  const matchIso = limpio.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (matchIso) {
    const [, y, m, d] = matchIso;
    return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  }

  // Formato DD/MM/YYYY o DD-MM-YYYY
  const matchLatam = limpio.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (matchLatam) {
    const [, d, m, y] = matchLatam;
    return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  }

  // Formato español: "1 de abril de 2026" o "1 de abril"
  const matchEs = limpio.match(/(\d{1,2})\s+de\s+([a-z]+)(?:\s+de\s+(\d{4}))?/);
  if (matchEs) {
    const dia = Number(matchEs[1]);
    const mesNombre = matchEs[2];
    const anio = matchEs[3] ? Number(matchEs[3]) : anioPorDefecto;
    const mesIdx = MESES_ES[mesNombre];
    if (mesIdx !== undefined && anio && dia >= 1 && dia <= 31) {
      return new Date(Date.UTC(anio, mesIdx, dia));
    }
  }

  return null;
}

function extraerRangoFechas(texto) {
  if (!texto) return { fechaInicio: null, fechaFin: null };

  // 1. Formato español "desde (el) <fecha1> hasta (el) <fecha2>" o "<fecha1> hasta (el) <fecha2>"
  const regexRangoEs = /(?:desde\s+(?:el\s+)?)?(\d{1,2}\s+de\s+[a-záéíóú]+(?:\s+de(?:l)?\s+\d{4})?)\s+(?:hasta|al)\s+(?:el\s+)?(\d{1,2}\s+de\s+[a-záéíóú]+\s+de(?:l)?\s+\d{4})/i;
  const matchEs = texto.match(regexRangoEs);
  if (matchEs) {
    const fechaFin = parsearFechaIndividual(matchEs[2]);
    const anioFin = fechaFin ? fechaFin.getUTCFullYear() : null;
    const fechaInicio = parsearFechaIndividual(matchEs[1], anioFin);
    if (fechaInicio && fechaFin) {
      return { fechaInicio, fechaFin };
    }
  }

  // 2. Formato numérico "01/04/2026 hasta/al/- 31/05/2026" o ISO
  const regexRangoNum = /(\d{1,4}[-/]\d{1,2}[-/]\d{1,4})\s*(?:hasta|al|-|–)\s*(?:el\s+)?(\d{1,4}[-/]\d{1,2}[-/]\d{1,4})/i;
  const matchNum = texto.match(regexRangoNum);
  if (matchNum) {
    const fechaInicio = parsearFechaIndividual(matchNum[1]);
    const fechaFin = parsearFechaIndividual(matchNum[2]);
    if (fechaInicio && fechaFin) {
      return { fechaInicio, fechaFin };
    }
  }

  return { fechaInicio: null, fechaFin: null };
}

function contarDiasHabiles(fechaInicio, fechaFin) {
  let dias = 0;
  const actual = new Date(fechaInicio.getTime());
  while (actual <= fechaFin) {
    const diaSemana = actual.getUTCDay(); // 0 = Domingo, 6 = Sabado
    if (diaSemana !== 0 && diaSemana !== 6) {
      dias++;
    }
    actual.setUTCDate(actual.getUTCDate() + 1);
  }
  return dias;
}

function mismasFechasUTC(d1, d2) {
  if (!d1 || !d2) return false;
  return (
    d1.getUTCFullYear() === d2.getUTCFullYear() &&
    d1.getUTCMonth() === d2.getUTCMonth() &&
    d1.getUTCDate() === d2.getUTCDate()
  );
}

function validarSinPlaceholders(texto, nombreDocumento) {
  const textoMin = texto.toLowerCase();
  for (const ph of PLACEHOLDERS_PLANTILLA) {
    if (textoMin.includes(ph)) {
      throw errorHttp(
        `El documento '${nombreDocumento}' aun contiene campos de plantilla o ejemplos sin llenar (${ph})`,
        400
      );
    }
  }
}

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
      if (typeof pdfParseModule === 'function') {
        const data = await pdfParseModule(buffer);
        return data.text || '';
      }
      if (pdfParseModule && typeof pdfParseModule.PDFParse === 'function') {
        const parser = new pdfParseModule.PDFParse({ data: buffer });
        try {
          const data = await parser.getText();
          const textoPlano = (data.text || '').replace(/--\s*\d+\s*of\s*\d+\s*--/gi, '').trim();
          if (textoPlano.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]/g, '').length >= 30) {
            return data.text || '';
          }
          // Respaldo OCR automatico para certificados escaneados o exportados como imagen
          const textoOcr = await aplicarOcrPdf(parser);
          return textoOcr || data.text || '';
        } finally {
          if (typeof parser.destroy === 'function') {
            await parser.destroy();
          }
        }
      }
      throw errorHttp('No se pudo inicializar el lector de PDF en el servidor', 500);
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

    return buffer.toString('utf-8');
  },

  // Analiza la Carta de Aceptación (CPP_ESFOT_001) para extraer datos empresariales, fechas y horas pactadas
  analizarCartaAceptacion(texto) {
    const datos = {
      esCartaAceptacion: false,
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

    datos.esCartaAceptacion = /CERTIFICO/i.test(texto) && /(?:horas diarias|completando un total de)/i.test(texto);

    // 1. Extraer responsable y empresa de "Yo, <nombre>, en mi calidad de <cargo> de <empresa>"
    const regexResp = /Yo,\s*([A-Za-záéíóúÁÉÍÓÚñÑ\s.]+?),\s*en mi calidad de\s+([A-Za-záéíóúÁÉÍÓÚñÑ\s./-]+?)\s+de\s+(?:la empresa\s+|la instituci[oó]n\s+)?([A-Za-z0-9áéíóúÁÉÍÓÚñÑ\s.,&'-]{2,70}?)(?:,|\ba petici[oó]n)/i;
    const matchResp = texto.match(regexResp);
    if (matchResp) {
      datos.responsable = matchResp[1].trim();
      datos.cargoResponsable = matchResp[2].trim();
      datos.razonSocial = matchResp[3].replace(/,\s*$/, '').trim();
    }

    // Fallback de empresa si no se extrajo en "Yo, ..."
    if (!datos.razonSocial) {
      const regexEmpresa = /(?:de la empresa|en la empresa|de la instituci[oó]n)\s+([A-Z0-9áéíóúÁÉÍÓÚñÑ\s.,&'-]{3,60})(?:,|\.|\ba petici[oó]n|\bCERTIFICO)/i;
      const matchEmpresa = texto.match(regexEmpresa);
      if (matchEmpresa && matchEmpresa[1]) {
        datos.razonSocial = matchEmpresa[1].replace(/,\s*$/, '').trim();
      }
    }

    // 2. Extraer horas totales pactadas
    const regexTotalHoras = /(?:completando\s+un\s+total\s+de|total\s+de|por\s+un\s+total\s+de|un\s+total\s+de)\s*(\d+)\s*horas/i;
    const matchTotalHoras = texto.match(regexTotalHoras);
    if (matchTotalHoras && matchTotalHoras[1]) {
      datos.totalHoras = parseInt(matchTotalHoras[1], 10);
    } else {
      const matchGeneralHoras = /(\d+)\s*(?:horas|h)\s*(?:de\s+pr[aá]cticas|de\s+duraci[oó]n|en\s+total)/i;
      const mg = texto.match(matchGeneralHoras);
      if (mg && mg[1]) datos.totalHoras = parseInt(mg[1], 10);
    }

    // 3. Extraer horas diarias
    const regexHorasDiarias = /dedicaci[oó]n\s+de\s*(\d+)\s*horas\s+diarias/i;
    const matchHorasDiarias = texto.match(regexHorasDiarias);
    if (matchHorasDiarias && matchHorasDiarias[1]) {
      datos.horasDiarias = Math.min(8, parseInt(matchHorasDiarias[1], 10));
    }

    // 4. Extraer cédula y nombre de estudiante
    const regexEstCedula = /(?:la se[ñn]orita|el se[ñn]or|estudiante)\s+([A-Za-záéíóúÁÉÍÓÚñÑ\s]+?)\s+con c[eé]dula(?: de identidad| de ciudadan[ií]a)?\s*(?:No\.|N[°º]|#)?\s*(\d{9,10}(?:-\d)?)/i;
    const matchEst = texto.match(regexEstCedula);
    if (matchEst) {
      datos.nombreEstudiante = matchEst[1].trim();
      datos.cedulaEstudiante = normalizarCedula(matchEst[2]);
    } else {
      const regexCedula = /(?:c[eé]dula(?: de identidad| de ciudadan[ií]a)?\s*(?:No\.|N[°º]|#)?\s*)(\d{9,10}(?:-\d)?)/i;
      const matchCedula = texto.match(regexCedula);
      if (matchCedula && matchCedula[1]) {
        datos.cedulaEstudiante = normalizarCedula(matchCedula[1]);
      }
    }

    // 5. Extraer área asignada
    const regexArea = /en el [aá]rea de\s+([A-Za-z0-9áéíóúÁÉÍÓÚñÑ\s/_-]{3,50})(?:,|\.|\bcon una dedicaci[oó]n)/i;
    const matchArea = texto.match(regexArea);
    if (matchArea && matchArea[1]) {
      datos.areaAsignada = matchArea[1].replace(/,\s*$/, '').trim();
    }

    // 6. Extraer cargo de estudiante
    const regexCargo = /bajo el cargo de\s+([A-Za-z0-9áéíóúÁÉÍÓÚñÑ\s/_-]{3,50})(?:,|\.|\ben el [aá]rea)/i;
    const matchCargo = texto.match(regexCargo);
    if (matchCargo && matchCargo[1]) {
      datos.cargoEstudiante = matchCargo[1].replace(/,\s*$/, '').trim();
    }

    // 7. Extraer fechas de inicio y fin
    const rango = extraerRangoFechas(texto);
    datos.fechaInicio = rango.fechaInicio;
    datos.fechaFin = rango.fechaFin;

    // 8. Extraer actividades previstas
    const matchActividades = texto.match(/actividades que se tiene previsto[\s\S]*?ser[aá]n:\s*([\s\S]*?)\bAtentamente\b/i);
    if (matchActividades && matchActividades[1]) {
      datos.actividadesPrevistas = matchActividades[1]
        .split(/\r?\n/)
        .map((l) => l.replace(/^[-•*\d.)\s]+/, '').trim())
        .filter((l) => l.length >= 5 && !/^[.…\s]+$/.test(l));
    }

    return datos;
  },

  // Analiza la Solicitud de Prácticas (FP-001)
  analizarSolicitudPracticas(texto) {
    const datos = {
      esSolicitudPracticas: false,
      nombreEstudiante: '',
      cedulaEstudiante: '',
      razonSocial: '',
      fechaInicio: null,
      fechaFin: null
    };

    if (!texto) return datos;

    const textoSinTildes = normalizarSinTildes(texto);
    datos.esSolicitudPracticas =
      textoSinTildes.includes('institucion / empresa receptora') ||
      (textoSinTildes.includes('solicito') && textoSinTildes.includes('periodo'));

    // 1. Extraer estudiante y cedula
    const regexEst = /yo\s+([A-Za-záéíóúÁÉÍÓÚñÑ\s]+?),\s*con c[eé]dula(?: de ciudadan[ií]a| de identidad)?\s*(?:N[°º]|No\.|#)?\s*(\d{9,10}(?:-\d)?)/i;
    const matchEst = texto.match(regexEst);
    if (matchEst) {
      datos.nombreEstudiante = matchEst[1].trim();
      datos.cedulaEstudiante = normalizarCedula(matchEst[2]);
    } else {
      const regexCed = /c[eé]dula(?: de ciudadan[ií]a| de identidad)?\s*(?:N[°º]|No\.|#)?\s*(\d{9,10}(?:-\d)?)/i;
      const matchCed = texto.match(regexCed);
      if (matchCed) datos.cedulaEstudiante = normalizarCedula(matchCed[1]);
    }

    // 2. Extraer empresa receptora
    const regexEmp = /INSTITUCI[OÓ]N\s*\/\s*EMPRESA\s+RECEPTORA:\s*([^\r\n]+)/i;
    const matchEmp = texto.match(regexEmp);
    if (matchEmp && matchEmp[1]) {
      datos.razonSocial = matchEmp[1].trim();
    }

    // 3. Extraer período
    const regexPeriodo = /PER[IÍ]ODO:\s*([^\r\n]+)/i;
    const matchPer = texto.match(regexPeriodo);
    const bloqueFecha = matchPer ? matchPer[1] : texto;
    const rango = extraerRangoFechas(bloqueFecha);
    datos.fechaInicio = rango.fechaInicio;
    datos.fechaFin = rango.fechaFin;

    return datos;
  },

  // Valida ambos PDFs obligatorios para creacion de aula de practicas laborales
  async validarDocumentosCreacionAula(cartaFile, solicitudFile, estudianteDb) {
    if (!cartaFile || !cartaFile.buffer) {
      throw errorHttp('El archivo PDF en el campo "cartaAceptacion" es obligatorio', 400);
    }
    if (!solicitudFile || !solicitudFile.buffer) {
      throw errorHttp('El archivo PDF en el campo "SolicitudPracticas" es obligatorio', 400);
    }

    const esPdfCarta =
      (cartaFile.originalname || '').toLowerCase().endsWith('.pdf') ||
      (cartaFile.mimetype || '').toLowerCase().includes('pdf');
    const esPdfSolicitud =
      (solicitudFile.originalname || '').toLowerCase().endsWith('.pdf') ||
      (solicitudFile.mimetype || '').toLowerCase().includes('pdf');

    if (!esPdfCarta) {
      throw errorHttp('El archivo de "cartaAceptacion" debe estar en formato PDF (.pdf)', 400);
    }
    if (!esPdfSolicitud) {
      throw errorHttp('El archivo de "SolicitudPracticas" debe estar en formato PDF (.pdf)', 400);
    }

    const textoCarta = await this.extraerTexto(cartaFile.buffer, cartaFile.originalname, 'application/pdf');
    const textoSolicitud = await this.extraerTexto(solicitudFile.buffer, solicitudFile.originalname, 'application/pdf');

    validarSinPlaceholders(textoCarta, 'cartaAceptacion');
    validarSinPlaceholders(textoSolicitud, 'SolicitudPracticas');

    const carta = this.analizarCartaAceptacion(textoCarta);
    const solicitud = this.analizarSolicitudPracticas(textoSolicitud);

    if (!carta.esCartaAceptacion) {
      throw errorHttp(
        'El PDF subido en "cartaAceptacion" no corresponde al formato oficial de Carta de Aceptacion (CPP_ESFOT_001)',
        400
      );
    }
    if (!solicitud.esSolicitudPracticas) {
      throw errorHttp(
        'El PDF subido en "SolicitudPracticas" no corresponde al formato oficial de Solicitud de Practicas (FP-001)',
        400
      );
    }

    // Verificar campos obligatorios completos en Carta de Aceptacion
    const faltantesCarta = [];
    if (!carta.razonSocial) faltantesCarta.push('Empresa receptora');
    if (!carta.cedulaEstudiante) faltantesCarta.push('Cedula del estudiante');
    if (!carta.fechaInicio || !carta.fechaFin) faltantesCarta.push('Fechas de inicio y fin');
    if (!carta.totalHoras || carta.totalHoras <= 0) faltantesCarta.push('Total de horas pactadas');
    if (!carta.cargoEstudiante) faltantesCarta.push('Cargo del estudiante');
    if (!carta.areaAsignada) faltantesCarta.push('Area asignada');
    if (carta.actividadesPrevistas.length === 0) faltantesCarta.push('Actividades previstas');

    if (faltantesCarta.length > 0) {
      throw errorHttp(
        `La Carta de Aceptacion tiene campos obligatorios incompletos: ${faltantesCarta.join(', ')}`,
        400
      );
    }

    // Verificar campos obligatorios completos en Solicitud de Practicas
    const faltantesSolicitud = [];
    if (!solicitud.cedulaEstudiante) faltantesSolicitud.push('Cedula del estudiante');
    if (!solicitud.razonSocial) faltantesSolicitud.push('Institucion / Empresa receptora');
    if (!solicitud.fechaInicio || !solicitud.fechaFin) faltantesSolicitud.push('Periodo (fecha inicio y fin)');

    if (faltantesSolicitud.length > 0) {
      throw errorHttp(
        `La Solicitud de Practicas tiene campos obligatorios incompletos: ${faltantesSolicitud.join(', ')}`,
        400
      );
    }

    // Coherencia cronologica
    if (carta.fechaFin <= carta.fechaInicio) {
      throw errorHttp('En la Carta de Aceptacion, la fecha fin debe ser posterior a la fecha de inicio', 400);
    }
    if (solicitud.fechaFin <= solicitud.fechaInicio) {
      throw errorHttp('En la Solicitud de Practicas, la fecha fin debe ser posterior a la fecha de inicio', 400);
    }

    // Validacion cruzada 1: Cedulas
    const cedulaDb = normalizarCedula(estudianteDb?.cedula || '');
    if (carta.cedulaEstudiante !== solicitud.cedulaEstudiante) {
      throw errorHttp(
        `La cedula en cartaAceptacion (${carta.cedulaEstudiante}) no coincide con la de SolicitudPracticas (${solicitud.cedulaEstudiante})`,
        400
      );
    }
    if (cedulaDb && carta.cedulaEstudiante !== cedulaDb) {
      throw errorHttp(
        `La cedula de los documentos (${carta.cedulaEstudiante}) no coincide con la del estudiante seleccionado (${cedulaDb})`,
        400
      );
    }

    // Validacion cruzada 2: Fechas coincidentes
    if (!mismasFechasUTC(carta.fechaInicio, solicitud.fechaInicio) || !mismasFechasUTC(carta.fechaFin, solicitud.fechaFin)) {
      throw errorHttp(
        'Las fechas de inicio y fin en la Carta de Aceptacion no coinciden con el periodo de la Solicitud de Practicas',
        400
      );
    }

    // Validacion cruzada 3: Empresa receptora coincidente
    const empCarta = normalizarEmpresa(carta.razonSocial);
    const empSol = normalizarEmpresa(solicitud.razonSocial);
    const empresasCoinciden =
      empCarta === empSol ||
      (empCarta.length >= 4 && empSol.includes(empCarta)) ||
      (empSol.length >= 4 && empCarta.includes(empSol));

    if (!empresasCoinciden) {
      throw errorHttp(
        `La empresa en cartaAceptacion ("${carta.razonSocial}") no coincide con la de SolicitudPracticas ("${solicitud.razonSocial}")`,
        400
      );
    }

    // Validacion cruzada 4: Coherencia dias habiles vs horas totales
    const diasHabiles = contarDiasHabiles(carta.fechaInicio, carta.fechaFin);
    const capacidadMaximaHoras = diasHabiles * (carta.horasDiarias || 8);
    if (carta.totalHoras > capacidadMaximaHoras) {
      throw errorHttp(
        `Las ${carta.totalHoras}h pactadas superan la capacidad de ${diasHabiles} dias habiles a ${carta.horasDiarias}h diarias (maximo ${capacidadMaximaHoras}h en ese periodo)`,
        400
      );
    }

    return {
      carta,
      solicitud,
      textoCarta,
      textoSolicitud
    };
  },

  // Valida y extrae datos del formulario Excel FCP_001A para convalidacion
  async validarYProcesarExcelFcp001a(buffer, modalidad = null, estudianteDb = null) {
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(buffer);
    } catch {
      throw errorHttp('El archivo Excel FCP-001A no es valido o esta corrupto. Use formato .xlsx o .xlsm', 400);
    }

    const worksheet = workbook.getWorksheet('FORMULARIO') || workbook.worksheets[0];
    if (!worksheet) {
      throw errorHttp('El archivo Excel no contiene una hoja valida para procesar el formulario FCP-001A', 400);
    }

    const encabezadoCodigo = obtenerTextoCelda(worksheet, 'J1').toUpperCase();
    const encabezadoTitulo = normalizarSinTildes(obtenerTextoCelda(worksheet, 'A6'));
    const nombreHoja = (worksheet.name || '').toUpperCase();
    if (!encabezadoCodigo.includes('FCP_001A') && !encabezadoTitulo.includes('convalidacion') && nombreHoja !== 'FORMULARIO') {
      throw errorHttp('El archivo Excel subido no corresponde al formato oficial FCP_001A', 400);
    }

    // Secciones 1 y 2: Casillas marcadas con X acorde a la modalidad
    const celdasLaboral = ['A14', 'A15', 'A16', 'A17', 'A18', 'A19', 'A23'];
    const celdasComunitario = ['F14', 'F15', 'F16', 'F17', 'F18', 'F19', 'F20'];
    const marcasLaboral = celdasLaboral.filter((ref) => obtenerTextoCelda(worksheet, ref).length > 0);
    const marcasComunitario = celdasComunitario.filter((ref) => obtenerTextoCelda(worksheet, ref).length > 0);
    const seccion1y2Marcas = [...marcasLaboral, ...marcasComunitario];

    if (modalidad === 'laboral') {
      if (marcasLaboral.length === 0) {
        throw errorHttp('En el formulario FCP-001A debe marcar al menos una opcion de convalidacion laboral (Seccion 1 o 2)', 400);
      }
      if (marcasComunitario.length > 0) {
        throw errorHttp('El formulario FCP-001A tiene marcada una opcion de servicio comunitario pero la modalidad del aula es laboral', 400);
      }
    } else if (modalidad === 'comunitario') {
      if (marcasComunitario.length === 0) {
        throw errorHttp('En el formulario FCP-001A debe marcar al menos una opcion de servicio comunitario (Seccion 1)', 400);
      }
      if (marcasLaboral.length > 0) {
        throw errorHttp('El formulario FCP-001A tiene marcada una opcion laboral pero la modalidad del aula es comunitario', 400);
      }
    }

    // Seccion 3: Datos del estudiante
    const estudianteNombre = obtenerTextoCelda(worksheet, 'C26');
    const cedula = normalizarCedula(obtenerTextoCelda(worksheet, 'C27'));
    const correo = obtenerTextoCelda(worksheet, 'C28');
    const telefonoEstudiante = obtenerTextoCelda(worksheet, 'H28');
    const celularEstudiante = obtenerTextoCelda(worksheet, 'J28');

    // Seccion 4: Documentacion de soporte adjunta (si viene vacio conserva el texto base)
    const textoSec4Raw = obtenerTextoCelda(worksheet, 'A31');
    const documentacionSoporte = textoSec4Raw || 'Listar los documentos que se adjuntan';

    // Seccion 5: Informacion de la institucion (campos con * son obligatorios, aceptando N/A)
    const razonSocial = obtenerTextoCelda(worksheet, 'C34');
    const ruc = obtenerTextoCelda(worksheet, 'C35');
    const direccion = obtenerTextoCelda(worksheet, 'C36');
    const ciudad = obtenerTextoCelda(worksheet, 'B37') || obtenerTextoCelda(worksheet, 'C37');
    const telefonoInst = obtenerTextoCelda(worksheet, 'H37');
    const celularInst = obtenerTextoCelda(worksheet, 'J37');
    const correoInst = obtenerTextoCelda(worksheet, 'D38') || obtenerTextoCelda(worksheet, 'C38');
    const tipoInstitucion = obtenerTextoCelda(worksheet, 'D39') || obtenerTextoCelda(worksheet, 'C39');
    const campoAmplio = obtenerTextoCelda(worksheet, 'D40');
    const campoEspecifico = obtenerTextoCelda(worksheet, 'D41');
    const codigoProyecto = obtenerTextoCelda(worksheet, 'D42');
    const nombreProyecto = obtenerTextoCelda(worksheet, 'H42');

    // Seccion 6: Informacion de las actividades realizadas
    const resumenActividades = obtenerTextoCelda(worksheet, 'A48');
    const contribucionConocimientos = obtenerTextoCelda(worksheet, 'A50');
    const resultadosAprendizaje = obtenerTextoCelda(worksheet, 'A52');
    const asignaturasMalla = obtenerTextoCelda(worksheet, 'A54');

    // Seccion 7: Informacion adicional
    const fechaInicio = parsearFechaCelda(worksheet, 'C58');
    const fechaFin = parsearFechaCelda(worksheet, 'H58');
    const horasSolicitadasRaw = obtenerTextoCelda(worksheet, 'C59') || obtenerTextoCelda(worksheet, 'F74');
    const horasSolicitadas = extraerNumeroHorasTexto(horasSolicitadasRaw);

    // Seccion 8: Responsabilidad y consentimiento (obligatoria, del estudiante)
    const nombreResponsabilidad = obtenerTextoCelda(worksheet, 'B63');
    const cedulaResponsabilidad = normalizarCedula(obtenerTextoCelda(worksheet, 'I63'));
    const fechaDeclaracion = parsearFechaCelda(worksheet, 'B65');

    const camposFaltantes = [];
    if (!estudianteNombre) camposFaltantes.push('Nombres y Apellidos del estudiante (Seccion 3 - C26)');
    if (!cedula) camposFaltantes.push('Cedula de Identidad (Seccion 3 - C27)');
    if (!correo) camposFaltantes.push('Correo electronico del estudiante (Seccion 3 - C28)');
    if (!razonSocial) camposFaltantes.push('Razon Social * (Seccion 5 - C34)');
    if (!ruc) camposFaltantes.push('RUC * (Seccion 5 - C35)');
    if (!direccion) camposFaltantes.push('Direccion * (Seccion 5 - C36)');
    if (!telefonoInst) camposFaltantes.push('Telefono * de la institucion (Seccion 5 - H37)');
    if (!celularInst) camposFaltantes.push('Celular * de la institucion (Seccion 5 - J37)');
    if (!resumenActividades) camposFaltantes.push('Resumen de actividades realizadas (Seccion 6 - A48)');
    if (!contribucionConocimientos) camposFaltantes.push('Contribucion al perfil de egreso (Seccion 6 - A50)');
    if (!resultadosAprendizaje) camposFaltantes.push('Resultados de aprendizaje (Seccion 6 - A52)');
    if (!asignaturasMalla) camposFaltantes.push('Asignaturas de la malla curricular (Seccion 6 - A54)');
    if (!fechaInicio) camposFaltantes.push('Fecha inicio (Seccion 7 - C58)');
    if (!fechaFin) camposFaltantes.push('Fecha fin (Seccion 7 - H58)');
    if (!horasSolicitadas || horasSolicitadas <= 0) camposFaltantes.push('Horas solicitadas (Seccion 7 - C59)');
    if (!nombreResponsabilidad || /colocar nombre/i.test(nombreResponsabilidad)) {
      camposFaltantes.push('Nombre en declaracion de responsabilidad (Seccion 8 - B63)');
    }
    if (!cedulaResponsabilidad || /colocar/i.test(cedulaResponsabilidad)) {
      camposFaltantes.push('Cedula en declaracion de responsabilidad (Seccion 8 - I63)');
    }
    if (!fechaDeclaracion) camposFaltantes.push('Fecha en declaracion de responsabilidad (Seccion 8 - B65)');

    if (camposFaltantes.length > 0) {
      throw errorHttp(
        `El formulario Excel FCP-001A tiene campos obligatorios incompletos: ${camposFaltantes.join(', ')}`,
        400
      );
    }

    if (fechaFin < fechaInicio) {
      throw errorHttp('En la Seccion 7 del FCP-001A, la fecha fin no puede ser anterior a la fecha inicio', 400);
    }

    const topeHoras = modalidad === 'laboral' ? 240 : 96;
    if (modalidad && horasSolicitadas > topeHoras) {
      throw errorHttp(
        `Las horas solicitadas (${horasSolicitadas}h) superan el maximo reglamentario de ${topeHoras}h para modalidad ${modalidad}`,
        400
      );
    }

    if (cedula !== cedulaResponsabilidad) {
      throw errorHttp(
        `La cedula de la Seccion 3 (${cedula}) no coincide con la de la Seccion 8 (${cedulaResponsabilidad})`,
        400
      );
    }

    if (!coincidenNombresPorTokens(estudianteNombre, nombreResponsabilidad)) {
      throw errorHttp(
        `El nombre de la Seccion 3 ("${estudianteNombre}") no coincide con el de la Seccion 8 ("${nombreResponsabilidad}")`,
        400
      );
    }

    if (estudianteDb) {
      const cedulaDb = normalizarCedula(estudianteDb.cedula || '');
      if (cedulaDb && cedula !== cedulaDb) {
        throw errorHttp(
          `La cedula del formulario FCP-001A (${cedula}) no coincide con la del estudiante seleccionado (${cedulaDb})`,
          400
        );
      }
      const nombreDb = `${estudianteDb.nombres || ''} ${estudianteDb.apellidos || ''}`.trim();
      if (nombreDb && !coincidenNombresPorTokens(nombreDb, estudianteNombre)) {
        throw errorHttp(
          `El nombre del formulario FCP-001A ("${estudianteNombre}") no coincide con el del estudiante seleccionado ("${nombreDb}")`,
          400
        );
      }
    }

    return {
      success: true,
      seccion1y2Marcas,
      estudianteNombre,
      cedula,
      correo,
      telefonoEstudiante,
      celularEstudiante,
      documentacionSoporte,
      razonSocial,
      ruc,
      direccion,
      ciudad,
      telefonoInst,
      celularInst,
      correoInst,
      tipoInstitucion,
      campoAmplio,
      campoEspecifico,
      codigoProyecto,
      nombreProyecto,
      resumenActividades,
      contribucionConocimientos,
      resultadosAprendizaje,
      asignaturasMalla,
      fechaInicio,
      fechaFin,
      horasSolicitadas,
      fechaDeclaracion
    };
  },

  // Extrae datos clave (nombre, horas, modalidad) del certificado PDF de convalidacion
  analizarCertificadoConvalidacion(textoCertificado = '') {
    const texto = String(textoCertificado || '');
    const textoNorm = normalizarSinTildes(texto);

    const horasMatches = [];
    const regexHoras = /(\d+(?:[.,]\d+)?)\s*(?:horas|hora|hrs|hr)\b/gi;
    let m;
    while ((m = regexHoras.exec(texto)) !== null) {
      const n = Number(m[1].replace(',', '.'));
      if (!isNaN(n) && n > 0 && n <= 1000) {
        horasMatches.push(n);
      }
    }

    const cedulaMatch = texto.match(/(?:c[eé]dula(?:\s+de\s+(?:ciudadan[ií]a|identidad))?|c\.?i\.?|documento)\s*(?:no\.?|n[°º]|#)?\s*[:.]?\s*(\d{9,10}(?:-\d)?)/i);
    const cedulaDetectada = cedulaMatch ? normalizarCedula(cedulaMatch[1]) : '';

    const esComunitarioExplicito = /(?:servicio\s+comunitario|actividades?\s+de\s+vinculaci[oó]n|vinculaci[oó]n\s+con\s+la\s+sociedad|juntas?\s+receptoras?\s+del\s+voto|voluntariado\s+comunitario|actividades?\s+solidarias)/i.test(textoNorm);
    const esCursoPlataforma = /(?:udemy|platzi|coursera|edx|certificado\s+de\s+finalizacion|certificacion\s+de\s+aprobacion|curso\s+de|curso\s+para)/i.test(textoNorm);
    const esLaboralExplicito = /(?:practicas?\s+(?:pre-?profesionales\s+)?laborales|experiencia\s+profesional)/i.test(textoNorm);

    return {
      textoNorm,
      horasDetectadas: horasMatches,
      horasMaximas: horasMatches.length > 0 ? Math.max(...horasMatches) : null,
      cedulaDetectada,
      esComunitarioExplicito,
      esCursoPlataforma,
      esLaboralExplicito
    };
  },

  // Valida Excel FCP-001A + Certificado PDF de convalidacion y cruza consistencia
  async validarDocumentosConvalidacion(excelFile, certificadoFile, modalidad, estudianteDb) {
    if (!excelFile || !excelFile.buffer) {
      throw errorHttp('El formulario Excel FCP-001A en el campo "formularioFcp001a" es obligatorio', 400);
    }
    if (!certificadoFile || !certificadoFile.buffer) {
      throw errorHttp('El certificado en PDF en el campo "certificado" es obligatorio', 400);
    }

    const nombreExcel = (excelFile.originalname || '').toLowerCase();
    const mimeExcel = (excelFile.mimetype || '').toLowerCase();
    const esExcelValido =
      nombreExcel.endsWith('.xlsx') ||
      nombreExcel.endsWith('.xlsm') ||
      mimeExcel.includes('spreadsheetml') ||
      mimeExcel.includes('ms-excel.sheet.macroenabled');

    if (!esExcelValido || nombreExcel.endsWith('.xls')) {
      throw errorHttp('El archivo de "formularioFcp001a" debe ser un Excel valido (.xlsx o .xlsm)', 400);
    }

    const nombrePdf = (certificadoFile.originalname || '').toLowerCase();
    const mimePdf = (certificadoFile.mimetype || '').toLowerCase();
    if (!nombrePdf.endsWith('.pdf') && !mimePdf.includes('pdf')) {
      throw errorHttp('El archivo de "certificado" debe estar unicamente en formato PDF (.pdf)', 400);
    }

    // 1. Validar que el formulario FCP-001A tenga todas las secciones del estudiante completas
    const datosExcel = await this.validarYProcesarExcelFcp001a(excelFile.buffer, modalidad, estudianteDb);

    // 2. Extraer texto del certificado PDF (soporta PDF digital y PDF escaneado via OCR)
    const textoCertificado = await this.extraerTexto(
      certificadoFile.buffer,
      certificadoFile.originalname,
      'application/pdf'
    );
    const cert = this.analizarCertificadoConvalidacion(textoCertificado);

    if (cert.textoNorm.replace(/[^a-z0-9]/g, '').length < 20) {
      throw errorHttp('No se pudo leer contenido legible del certificado PDF adjunto', 400);
    }

    // 3. Validar que el nombre del estudiante concuerde con el certificado
    const nombreReferencia = estudianteDb
      ? `${estudianteDb.nombres || ''} ${estudianteDb.apellidos || ''}`.trim()
      : datosExcel.estudianteNombre;

    const coincideNombreCert =
      coincidenNombresPorTokens(nombreReferencia, textoCertificado) ||
      coincidenNombresPorTokens(datosExcel.estudianteNombre, textoCertificado);

    if (!coincideNombreCert) {
      throw errorHttp(
        `El nombre del estudiante ("${datosExcel.estudianteNombre}") no concuerda con el certificado PDF adjunto`,
        400
      );
    }

    // 4. Si el certificado incluye cedula explicita, validar que concuerde
    if (cert.cedulaDetectada && cert.cedulaDetectada !== datosExcel.cedula) {
      throw errorHttp(
        `La cedula encontrada en el certificado (${cert.cedulaDetectada}) no coincide con la del estudiante (${datosExcel.cedula})`,
        400
      );
    }

    // 5. Validar consistencia de modalidad entre el aula y el certificado
    if (modalidad === 'laboral' && cert.esComunitarioExplicito) {
      throw errorHttp(
        'Inconsistencia de modalidad: el aula es laboral pero el certificado corresponde a servicio comunitario o vinculacion',
        400
      );
    }
    if (modalidad === 'comunitario' && (cert.esLaboralExplicito || (cert.esCursoPlataforma && !cert.esComunitarioExplicito))) {
      throw errorHttp(
        'Inconsistencia de modalidad: el aula es comunitario pero el certificado corresponde a un curso profesional o practica laboral',
        400
      );
    }

    // 6. Validar que las horas del formulario FCP-001A concuerden con las del certificado
    if (cert.horasDetectadas.length === 0) {
      throw errorHttp(
        'No se pudo identificar la cantidad de horas en el certificado PDF adjunto',
        400
      );
    }

    const topeModalidad = modalidad === 'laboral' ? 240 : 96;
    const coincideHorasExacta = cert.horasDetectadas.some((h) => Math.abs(h - datosExcel.horasSolicitadas) < 0.05);
    const superaCertificado = datosExcel.horasSolicitadas > (cert.horasMaximas || 0) + 0.05;
    const casoTopePermitido =
      datosExcel.horasSolicitadas === topeModalidad && (cert.horasMaximas || 0) >= topeModalidad;

    if (superaCertificado || (!coincideHorasExacta && !casoTopePermitido)) {
      throw errorHttp(
        `Inconsistencia de horas: el FCP-001A solicita ${datosExcel.horasSolicitadas}h pero el certificado indica ${cert.horasMaximas}h`,
        400
      );
    }

    return {
      datosExcel,
      textoCertificado,
      certificadoAnalisis: cert
    };
  }
};
