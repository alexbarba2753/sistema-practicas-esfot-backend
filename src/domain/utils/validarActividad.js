import { errorHttp } from './errorHttp.js';

// Validaciones de negocio para jornadas de practicas laborales (HU-011)
export function validarJornadaLaboral(datos, aula, resumenActual) {
  const { fecha, horaEntrada, horaSalida, horas, descripcion } = datos;

  if (!fecha || !horaEntrada || !horaSalida || horas === undefined || horas === null || !descripcion) {
    throw errorHttp('Fecha, hora de entrada, hora de salida, numero de horas y descripcion tecnica son obligatorios', 400);
  }

  // 1. Formato de 24 horas HH:mm
  const formatoHoraRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  const entradaTrim = String(horaEntrada).trim();
  const salidaTrim = String(horaSalida).trim();

  if (!formatoHoraRegex.test(entradaTrim) || !formatoHoraRegex.test(salidaTrim)) {
    throw errorHttp('El formato de hora debe ser HH:mm en 24 horas (ejemplo: 08:00, 16:30)', 400);
  }

  // 2. Hora de salida posterior a hora de entrada
  const [hE, mE] = entradaTrim.split(':').map(Number);
  const [hS, mS] = salidaTrim.split(':').map(Number);
  const minEntrada = hE * 60 + mE;
  const minSalida = hS * 60 + mS;

  if (minSalida <= minEntrada) {
    throw errorHttp('La hora de salida debe ser posterior a la hora de entrada', 400);
  }

  const minutosTranscurridos = minSalida - minEntrada;
  const horasTranscurridas = minutosTranscurridos / 60;

  // 3. Rango de horas entre 0.5h y 8h
  const numHoras = Number(horas);
  if (isNaN(numHoras) || numHoras < 0.5 || numHoras > 8) {
    throw errorHttp('El numero de horas diarias debe ser un valor entre 0.5 y 8 horas reglamentarias', 400);
  }

  if (numHoras > horasTranscurridas) {
    throw errorHttp(
      `Las horas reportadas (${numHoras}h) exceden el tiempo cronologico entre entrada y salida (${horasTranscurridas.toFixed(1)}h)`,
      400
    );
  }

  // 4. Bloques de 10 minutos
  const minutosTrabajados = Math.round(numHoras * 60);
  if (minutosTrabajados % 10 !== 0) {
    throw errorHttp('El numero de horas debe registrarse en fracciones de bloques de 10 minutos (ejemplo: 2h, 4.5h, 6h, 8h)', 400);
  }

  // 5. Fecha valida y no futura
  const fechaObj = new Date(fecha);
  if (isNaN(fechaObj.getTime())) {
    throw errorHttp('La fecha proporcionada no tiene un formato valido (YYYY-MM-DD)', 400);
  }

  const ahora = new Date();
  const finHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 23, 59, 59, 999);
  if (fechaObj > finHoy) {
    throw errorHttp('No se pueden registrar actividades con fechas futuras a la fecha actual', 400);
  }

  if (aula?.fechaInicio) {
    const fechaInicioAula = new Date(aula.fechaInicio);
    fechaInicioAula.setHours(0, 0, 0, 0);
    if (fechaObj < fechaInicioAula) {
      throw errorHttp(
        `La fecha de la actividad no puede ser anterior al inicio del aula virtual (${fechaInicioAula.toISOString().split('T')[0]})`,
        400
      );
    }
  }

  // 6. Longitud minima de descripcion
  const descripcionTrim = String(descripcion).trim();
  if (descripcionTrim.length < 15) {
    throw errorHttp('La descripcion tecnica debe tener al menos 15 caracteres detallando las tareas desarrolladas', 400);
  }

  return {
    fechaObj,
    horaEntrada: entradaTrim,
    horaSalida: salidaTrim,
    horas: numHoras,
    descripcion: descripcionTrim
  };
}

// Validaciones de negocio para actividades comunitarias
export function validarActividadComunitariaDatos(datos, aula, resumenActual) {
  const { comunidadOInstitucion, horas, descripcion, fecha } = datos;

  if (!comunidadOInstitucion || horas === undefined || horas === null || !descripcion) {
    throw errorHttp('Comunidad o institucion, numero de horas y descripcion de tareas son obligatorios', 400);
  }

  const numHoras = Number(horas);
  if (isNaN(numHoras) || numHoras < 1 || numHoras > 96) {
    throw errorHttp('Las horas de actividad comunitaria deben ser entre 1 y 96 horas reglamentarias', 400);
  }

  const descripcionTrim = String(descripcion).trim();
  if (descripcionTrim.length < 15) {
    throw errorHttp('La descripcion de actividades comunitarias debe tener al menos 15 caracteres', 400);
  }

  let fechaObj = new Date();
  if (fecha) {
    fechaObj = new Date(fecha);
    if (isNaN(fechaObj.getTime())) {
      throw errorHttp('La fecha proporcionada no tiene un formato valido', 400);
    }
    const ahora = new Date();
    const finHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 23, 59, 59, 999);
    if (fechaObj > finHoy) {
      throw errorHttp('No se pueden registrar actividades comunitarias con fecha futura', 400);
    }
  }

  return {
    comunidadOInstitucion: comunidadOInstitucion.trim(),
    horas: numHoras,
    descripcion: descripcionTrim,
    fechaObj
  };
}
