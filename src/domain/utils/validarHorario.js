import { errorHttp } from './errorHttp.js';

export const DIAS_SEMANA_INDICE = [
  'domingo',
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado'
];

export const DIAS_ORDENADOS = [
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
  'domingo'
];

function parsearHoraAMinutos(horaStr, dia, campo) {
  const regex = /^([01]?\d|2[0-3]):([0-5]\d)$/;
  const match = String(horaStr || '').trim().match(regex);
  if (!match) {
    throw errorHttp(`Formato de ${campo} invalido en ${dia} (use HH:mm, ejemplo: 08:00)`, 400);
  }
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  return {
    minutos: hh * 60 + mm,
    normalizada: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
  };
}

export function validarYCalcularHorarioSemanal(datos = {}, aula = {}) {
  const horarioNormalizado = {};
  const horasPorDia = {};
  let totalMinutosSemana = 0;

  for (const dia of DIAS_ORDENADOS) {
    const bloques = datos[dia];
    if (bloques === undefined || bloques === null) {
      horarioNormalizado[dia] = [];
      horasPorDia[dia] = 0;
      continue;
    }

    if (!Array.isArray(bloques)) {
      throw errorHttp(`El campo '${dia}' debe ser un arreglo de bloques { horaInicio, horaFin }`, 400);
    }

    const bloquesParsed = bloques.map((b) => {
      if (!b || !b.horaInicio || !b.horaFin) {
        throw errorHttp(`Cada bloque de ${dia} debe incluir horaInicio y horaFin`, 400);
      }
      const ini = parsearHoraAMinutos(b.horaInicio, dia, 'horaInicio');
      const fin = parsearHoraAMinutos(b.horaFin, dia, 'horaFin');
      if (fin.minutos <= ini.minutos) {
        throw errorHttp(`En ${dia}, la horaFin (${fin.normalizada}) debe ser posterior a horaInicio (${ini.normalizada})`, 400);
      }
      return {
        minIni: ini.minutos,
        minFin: fin.minutos,
        horaInicio: ini.normalizada,
        horaFin: fin.normalizada
      };
    });

    bloquesParsed.sort((a, b) => a.minIni - b.minIni);

    let minutosDia = 0;
    for (let i = 0; i < bloquesParsed.length; i++) {
      const actual = bloquesParsed[i];
      if (i > 0 && actual.minIni < bloquesParsed[i - 1].minFin) {
        throw errorHttp(`Los bloques de ${dia} se traslapan entre si`, 400);
      }
      minutosDia += actual.minFin - actual.minIni;
    }

    const horasDia = Math.round((minutosDia / 60) * 100) / 100;
    if (horasDia > 8) {
      throw errorHttp(`El total diario en ${dia} (${horasDia}h) excede el maximo reglamentario de 8 horas`, 400);
    }

    horarioNormalizado[dia] = bloquesParsed.map(({ horaInicio, horaFin }) => ({ horaInicio, horaFin }));
    horasPorDia[dia] = horasDia;
    totalMinutosSemana += minutosDia;
  }

  const horasSemanales = Math.round((totalMinutosSemana / 60) * 100) / 100;
  if (horasSemanales <= 0) {
    throw errorHttp('Debes ingresar al menos un bloque horario en la semana', 400);
  }

  let horasProyectadas = 0;
  if (aula?.fechaInicio && aula?.fechaFin) {
    const fInicio = new Date(aula.fechaInicio);
    const fFin = new Date(aula.fechaFin);
    const cursor = new Date(Date.UTC(fInicio.getUTCFullYear(), fInicio.getUTCMonth(), fInicio.getUTCDate()));
    const limite = new Date(Date.UTC(fFin.getUTCFullYear(), fFin.getUTCMonth(), fFin.getUTCDate()));

    while (cursor <= limite) {
      const nombreDia = DIAS_SEMANA_INDICE[cursor.getUTCDay()];
      horasProyectadas += horasPorDia[nombreDia] || 0;
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    horasProyectadas = Math.round(horasProyectadas * 100) / 100;

    if (aula.horasRequeridas && horasProyectadas < aula.horasRequeridas) {
      const inicioStr = fInicio.toISOString().split('T')[0];
      const finStr = fFin.toISOString().split('T')[0];
      throw errorHttp(
        `El horario ingresado proyecta ${horasProyectadas}h entre ${inicioStr} y ${finStr}, lo cual no cubre el tiempo acordado en la carta de aceptacion (${aula.horasRequeridas}h)`,
        400
      );
    }
  }

  return {
    horarioNormalizado,
    horasSemanales,
    horasProyectadas
  };
}
