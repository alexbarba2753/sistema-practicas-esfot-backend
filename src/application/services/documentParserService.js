import mammoth from 'mammoth';
import { createRequire } from 'module';
import ExcelJS from 'exceljs';
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
          return data.text || '';
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

  // Valida y extrae datos del formulario Excel FCP_001A para convalidación
  async validarYProcesarExcelFcp001a(buffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const worksheet = workbook.getWorksheet('FORMULARIO') || workbook.worksheets[0];
    if (!worksheet) {
      throw errorHttp('El archivo Excel no contiene una hoja valida para procesar el formulario FCP-001A', 400);
    }

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
