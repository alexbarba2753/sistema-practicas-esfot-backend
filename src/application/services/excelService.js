import path from 'path';
import fs from 'fs';
import ExcelJS from 'exceljs';
import { errorHttp } from '../../domain/utils/errorHttp.js';

const TEMPLATES_DIR = path.join(process.cwd(), 'documentacion');
const DESCARGAS_DIR = path.join(process.cwd(), 'archivos_descargados');
const PLANTILLA_LABORAL = path.join(TEMPLATES_DIR, 'f_aa_119_informe_de_practicas_preprofesionales_1.xlsx');
const PLANTILLA_COMUNITARIO = path.join(TEMPLATES_DIR, 'fcp_001a_informe_convalidacion_reconocimiento_pp.xlsx');

// Limpia marcas de formato o saltos para que el texto encaje limpio en las celdas de Excel
export function limpiarTextoParaExcel(texto) {
  if (!texto || typeof texto !== 'string') return '';

  let limpio = texto
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/^\s*[-*_]{3,}\s*$/gm, '')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^\|[-:| ]+\|\s*$/gm, '');

  const lineas = limpio.split('\n');
  const lineasProcesadas = [];

  for (const linea of lineas) {
    const l = linea.trim();
    if (l.startsWith('|') && l.endsWith('|')) {
      const celdas = l.split('|').map((c) => c.trim()).filter((c) => c.length > 0);
      if (celdas.some((c) => /código|asignatura|temática|evidencia/i.test(c))) {
        continue;
      }
      if (celdas.length >= 2) {
        lineasProcesadas.push(`• ${celdas[0]}: ${celdas.slice(1).join(' - ')}`);
      } else if (celdas.length === 1) {
        lineasProcesadas.push(`• ${celdas[0]}`);
      }
    } else {
      lineasProcesadas.push(linea);
    }
  }

  limpio = lineasProcesadas.join('\n');
  limpio = limpio
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return limpio;
}

function guardarCopiaLocal(filename, buffer) {
  try {
    if (!fs.existsSync(DESCARGAS_DIR)) {
      fs.mkdirSync(DESCARGAS_DIR, { recursive: true });
    }
    const rutaDestino = path.join(DESCARGAS_DIR, filename);
    fs.writeFileSync(rutaDestino, buffer);
  } catch (err) {
    console.error('Error al guardar copia local:', err.message);
  }
}

export const excelService = {
  // Genera el archivo Excel F_AA_119 para practicas empresariales y laborales
  async generarExcelInformeLaboral({ aula, estudiante, docente, formularioPendiente }) {
    const workbook = new ExcelJS.Workbook();
    let worksheet;

    if (fs.existsSync(PLANTILLA_LABORAL)) {
      await workbook.xlsx.readFile(PLANTILLA_LABORAL);
      worksheet = workbook.getWorksheet('FORMULARIO') || workbook.worksheets[0];
    } else {
      worksheet = workbook.addWorksheet('FORMULARIO');
      worksheet.getCell('A1').value = 'INFORME F_AA_119 - PRACTICAS PREPROFESIONALES';
    }

    const nombreCompletoEstudiante = `${estudiante?.nombres || ''} ${estudiante?.apellidos || ''}`.trim();
    const nombreCompletoDocente = docente ? `${docente?.nombres || ''} ${docente?.apellidos || ''}`.trim() : '';
    const entidad = formularioPendiente?.entidadReceptora || {};
    const contenido = formularioPendiente?.contenidoIa || {};

    // 1. Datos de la entidad receptora
    if (entidad.razonSocial) worksheet.getCell('D10').value = entidad.razonSocial;
    if (entidad.ruc) worksheet.getCell('D11').value = entidad.ruc;
    if (entidad.direccion) worksheet.getCell('D12').value = entidad.direccion;
    if (entidad.correo) worksheet.getCell('D13').value = entidad.correo;
    if (entidad.ciudad) worksheet.getCell('C14').value = entidad.ciudad;
    if (entidad.telefono) worksheet.getCell('H14').value = entidad.telefono;
    if (entidad.celular) worksheet.getCell('J14').value = entidad.celular;
    if (entidad.tipoEntidad) worksheet.getCell('E15').value = entidad.tipoEntidad;
    if (entidad.responsable) worksheet.getCell('E16').value = entidad.responsable;

    // 2. Datos del practicante
    worksheet.getCell('E21').value = nombreCompletoEstudiante;
    worksheet.getCell('E22').value = estudiante?.cedula || '';
    worksheet.getCell('E23').value = formularioPendiente?.creditosAprobados || '';

    // 3. Responsabilidad y consentimiento
    worksheet.getCell('B26').value = nombreCompletoEstudiante;
    worksheet.getCell('I26').value = estudiante?.cedula || '';

    // 4. Datos de la practica
    if (nombreCompletoDocente) worksheet.getCell('D33').value = nombreCompletoDocente;
    if (contenido.asignaturasUtilidad) {
      const textoMaterias = limpiarTextoParaExcel(contenido.asignaturasUtilidad)
        .replace(/;\s*/g, '\n• ')
        .replace(/^([^•\n])/, '• $1');
      const cellA43 = worksheet.getCell('A43');
      cellA43.value = textoMaterias;
      cellA43.font = { name: 'Tahoma', size: 9, color: { argb: 'FF000000' } };
      cellA43.alignment = { wrapText: true, vertical: 'top', horizontal: 'left' };
      const numLineasMaterias = textoMaterias.split('\n').length;
      worksheet.getRow(43).height = Math.max(45, numLineasMaterias * 15 + 8);
    }

    // 5. Actividades desarrolladas
    worksheet.getCell('D47').value = entidad.areaAsignada || 'Desarrollo de Software / TI';
    if (aula?.fechaInicio) {
      worksheet.getCell('E49').value = new Date(aula.fechaInicio).toLocaleDateString('es-EC');
    }
    if (aula?.fechaFin) {
      worksheet.getCell('H49').value = new Date(aula.fechaFin).toLocaleDateString('es-EC');
    }

    const horario = formularioPendiente?.horarioSemanal || {};
    const horaIni = horario.horaInicio || '08:00';
    const horaFin = horario.horaFin || '16:30';
    const horasSem = horario.horasSemanales || 40;

    ['B51', 'C51', 'D51', 'E51', 'F51'].forEach((ref) => {
      const c = worksheet.getCell(ref);
      c.value = horaIni;
      c.font = { name: 'Tahoma', size: 8, bold: true, color: { argb: 'FF000000' } };
      c.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    ['B52', 'C52', 'D52', 'E52', 'F52'].forEach((ref) => {
      const c = worksheet.getCell(ref);
      c.value = horaFin;
      c.font = { name: 'Tahoma', size: 8, bold: true, color: { argb: 'FF000000' } };
      c.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    const cellHorasSem = worksheet.getCell('I52');
    cellHorasSem.value = horasSem;
    cellHorasSem.font = { name: 'Tahoma', size: 9, bold: true, color: { argb: 'FF000000' } };
    cellHorasSem.alignment = { vertical: 'middle', horizontal: 'center' };

    worksheet.getCell('I54').value = formularioPendiente?.totalHoras || aula?.horasRequeridas || 240;

    if (contenido.principalesActividades) {
      const textoAct = limpiarTextoParaExcel(contenido.principalesActividades);
      const cellA56 = worksheet.getCell('A56');
      cellA56.value = textoAct;
      cellA56.font = { name: 'Tahoma', size: 9, color: { argb: 'FF000000' } };
      cellA56.alignment = { wrapText: true, vertical: 'top', horizontal: 'left' };
      const lineasAct = Math.max(textoAct.split('\n').length, Math.ceil(textoAct.length / 110));
      worksheet.getRow(56).height = Math.max(60, lineasAct * 14 + 10);
    }

    if (contenido.habilidadesAdquiridas) {
      const textoHab = limpiarTextoParaExcel(contenido.habilidadesAdquiridas);
      const cellA58 = worksheet.getCell('A58');
      cellA58.value = textoHab;
      cellA58.font = { name: 'Tahoma', size: 9, color: { argb: 'FF000000' } };
      cellA58.alignment = { wrapText: true, vertical: 'top', horizontal: 'left' };
      const lineasHab = Math.max(textoHab.split('\n').length, Math.ceil(textoHab.length / 110));
      worksheet.getRow(58).height = Math.max(45, lineasHab * 14 + 10);
    }

    const textoObs = limpiarTextoParaExcel(
      contenido.observacionesTemas ||
        'Durante la ejecución de las actividades asignadas fue necesario profundizar de manera autónoma en herramientas de versionamiento colaborativo, pruebas de integración y despliegue de servicios, complementando los contenidos teóricos revisados en clases.'
    );
    const cellA62 = worksheet.getCell('A62');
    cellA62.value = textoObs;
    cellA62.font = { name: 'Tahoma', size: 9, color: { argb: 'FF000000' } };
    cellA62.alignment = { wrapText: true, vertical: 'top', horizontal: 'left' };
    const lineasObs = Math.max(textoObs.split('\n').length, Math.ceil(textoObs.length / 110));
    worksheet.getRow(62).height = Math.max(40, lineasObs * 14 + 10);

    // Evaluacion cualitativa: marcar X en Excelente (columna G, filas 66-69)
    ['G66', 'G67', 'G68', 'G69'].forEach((ref) => {
      const c = worksheet.getCell(ref);
      c.value = 'X';
      c.font = { name: 'Tahoma', size: 9, bold: true, color: { argb: 'FF000000' } };
      c.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    // 6. Seguimiento y evaluacion del tutor academico (adaptado a modalidad virtual y tutor de practicas)
    const seg = formularioPendiente?.seguimientoTutor || {};
    worksheet.getCell('F79').value =
      'El estudiante proporciona detalles sobre las actividades que está llevando a cabo en la empresa mediante reunión virtual';
    worksheet.getCell('A80').value = 'Llamada telefónica al tutor de prácticas, Supervisor de las Prácticas';

    if (seg.completadoPorTutor) {
      worksheet.getCell('B74').value = seg.conformidadPlan !== false ? 'X' : '';
      worksheet.getCell('D74').value = seg.conformidadPlan === false ? 'X' : '';
      if (seg.observacionesPlan) worksheet.getCell('G74').value = seg.observacionesPlan;
      if (seg.novedades) worksheet.getCell('A76').value = seg.novedades;

      const actsSeg = Array.isArray(seg.actividadesSeguimiento) ? seg.actividadesSeguimiento : [];
      [79, 80, 81].forEach((fila, idx) => {
        if (actsSeg[idx]) {
          if (actsSeg[idx].actividad) worksheet.getCell(`A${fila}`).value = actsSeg[idx].actividad;
          if (actsSeg[idx].fecha) {
            worksheet.getCell(`D${fila}`).value = new Date(actsSeg[idx].fecha).toLocaleDateString('es-EC');
          }
          if (actsSeg[idx].resultados) worksheet.getCell(`F${fila}`).value = actsSeg[idx].resultados;
        }
      });

      const evalT = seg.evaluacionCualitativaTutor || {};
      worksheet.getCell('G85').value = evalT.recomiendaEntidad !== false ? 'X' : '';
      worksheet.getCell('H85').value = evalT.recomiendaEntidad === false ? 'X' : '';
      worksheet.getCell('G86').value = evalT.aportaPerfilEgreso !== false ? 'X' : '';
      worksheet.getCell('H86').value = evalT.aportaPerfilEgreso === false ? 'X' : '';
      worksheet.getCell('G87').value = evalT.recomiendaAprobacion !== false ? 'X' : '';
      worksheet.getCell('H87').value = evalT.recomiendaAprobacion === false ? 'X' : '';
      if (seg.observacionesMejora) {
        worksheet.getCell('A88').value = `Observaciones / acciones de mejora: ${seg.observacionesMejora}`;
      }
    }

    // 8. Firmas de responsabilidad: izquierda Tutor EPN, derecha Entidad Receptora
    if (nombreCompletoDocente) worksheet.getCell('B103').value = nombreCompletoDocente;
    if (docente?.cedula) worksheet.getCell('B104').value = docente.cedula;
    worksheet.getCell('G103').value = entidad.responsable || '';
    worksheet.getCell('G104').value = entidad.cedulaResponsable || '';

    const buffer = await workbook.xlsx.writeBuffer();
    const safeCedula = (estudiante?.cedula || 'ESTUDIANTE').replace(/[^a-zA-Z0-9_-]/g, '');
    const filename = `F_AA_119_Informe_Practicas_Laborales_${safeCedula}.xlsx`;

    guardarCopiaLocal(filename, buffer);

    return { buffer, filename };
  },

  // Genera el archivo Excel FCP_001A para convalidacion y servicio comunitario
  async generarExcelInformeComunitario({ aula, estudiante, docente, formularioPendiente }) {
    const workbook = new ExcelJS.Workbook();
    let worksheet;

    if (fs.existsSync(PLANTILLA_COMUNITARIO)) {
      await workbook.xlsx.readFile(PLANTILLA_COMUNITARIO);
      worksheet = workbook.getWorksheet('FORMULARIO') || workbook.worksheets[0];
    } else {
      worksheet = workbook.addWorksheet('FORMULARIO');
      worksheet.getCell('A1').value = 'INFORME FCP_001A - CONVALIDACION Y SERVICIO COMUNITARIO';
    }

    const nombreCompletoEstudiante = `${estudiante?.nombres || ''} ${estudiante?.apellidos || ''}`.trim();
    const nombreCompletoDocente = docente ? `${docente?.nombres || ''} ${docente?.apellidos || ''}`.trim() : '';
    const entidad = formularioPendiente?.entidadReceptora || {};
    const contenido = formularioPendiente?.contenidoIa || {};

    // 2. Tipo de convalidacion solicitada
    worksheet.getCell('F18').value = 'X';

    // 3. Informacion personal del estudiante
    worksheet.getCell('C26').value = nombreCompletoEstudiante;
    worksheet.getCell('C27').value = estudiante?.cedula || '';
    worksheet.getCell('C28').value = estudiante?.correo || '';
    worksheet.getCell('H28').value = estudiante?.telefono || '';
    worksheet.getCell('J28').value = estudiante?.telefono || '';

    // 4. Documentacion soporte
    worksheet.getCell('A31').value = 'Bitacoras aprobadas en plataforma digital, registro de beneficiarios comunitarios y memoria de impacto social.';

    // 5. Entidad u organizacion comunitaria
    if (entidad.razonSocial) worksheet.getCell('C34').value = entidad.razonSocial;
    if (entidad.ruc) worksheet.getCell('C35').value = entidad.ruc;
    if (entidad.direccion) worksheet.getCell('C36').value = entidad.direccion;
    if (entidad.ciudad) worksheet.getCell('C37').value = entidad.ciudad;
    if (entidad.telefono) worksheet.getCell('H37').value = entidad.telefono;
    if (entidad.correo) worksheet.getCell('C38').value = entidad.correo;
    if (entidad.tipoEntidad) worksheet.getCell('C39').value = entidad.tipoEntidad;

    // 6. Actividades comunitarias desarrolladas
    if (contenido.resumenActividades) {
      const cell = worksheet.getCell('A48');
      cell.value = limpiarTextoParaExcel(contenido.resumenActividades);
      cell.font = { name: 'Tahoma', size: 9, color: { argb: 'FF000000' } };
      cell.alignment = { wrapText: true, vertical: 'top', horizontal: 'left' };
    }
    if (contenido.contribucionConocimientos) {
      const cell = worksheet.getCell('A50');
      cell.value = limpiarTextoParaExcel(contenido.contribucionConocimientos);
      cell.font = { name: 'Tahoma', size: 9, color: { argb: 'FF000000' } };
      cell.alignment = { wrapText: true, vertical: 'top', horizontal: 'left' };
    }
    if (contenido.resultadosAprendizaje) {
      const cell = worksheet.getCell('A52');
      cell.value = limpiarTextoParaExcel(contenido.resultadosAprendizaje);
      cell.font = { name: 'Tahoma', size: 9, color: { argb: 'FF000000' } };
      cell.alignment = { wrapText: true, vertical: 'top', horizontal: 'left' };
    }
    if (contenido.asignaturasMalla) {
      const cell = worksheet.getCell('A54');
      cell.value = limpiarTextoParaExcel(contenido.asignaturasMalla);
      cell.font = { name: 'Tahoma', size: 9, color: { argb: 'FF000000' } };
      cell.alignment = { wrapText: true, vertical: 'top', horizontal: 'left' };
    }

    // 7. Fechas y horas reportadas
    if (aula?.fechaInicio) {
      worksheet.getCell('C58').value = new Date(aula.fechaInicio).toLocaleDateString('es-EC');
    }
    if (aula?.fechaFin) {
      worksheet.getCell('H58').value = new Date(aula.fechaFin).toLocaleDateString('es-EC');
    }
    worksheet.getCell('C59').value = formularioPendiente?.totalHoras || aula?.horasRequeridas || 96;

    // 8. Responsabilidad de la declaracion
    worksheet.getCell('B63').value = nombreCompletoEstudiante;
    worksheet.getCell('I63').value = estudiante?.cedula || '';
    worksheet.getCell('B65').value = new Date().toLocaleDateString('es-EC');

    // 9. Dictamen inicial del tutor academico
    if (nombreCompletoDocente) worksheet.getCell('C68').value = nombreCompletoDocente;
    worksheet.getCell('H68').value = 'ESFOT';
    worksheet.getCell('H69').value = 'X';
    worksheet.getCell('H70').value = 'X';
    worksheet.getCell('H71').value = 'X';
    worksheet.getCell('F74').value = formularioPendiente?.totalHoras || aula?.horasRequeridas || 96;

    const buffer = await workbook.xlsx.writeBuffer();
    const safeCedula = (estudiante?.cedula || 'ESTUDIANTE').replace(/[^a-zA-Z0-9_-]/g, '');
    const filename = `FCP_001A_Informe_Convalidacion_Comunitario_${safeCedula}.xlsx`;

    guardarCopiaLocal(filename, buffer);

    return { buffer, filename };
  }
};
