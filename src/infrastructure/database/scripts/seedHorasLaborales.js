import readline from 'readline';
import { connectDB, disconnectDB } from '../db.js';
import { AulaVirtual } from '../models/AulaVirtual.js';
import { ActividadLaboral } from '../models/ActividadLaboral.js';
import { ESTADOS_ACTIVIDAD, ESTADOS_AULA, MODALIDADES } from '../../../domain/constants/practicasConstants.js';

const MARCA_SEED = '[SEED]';

const DESCRIPCIONES_BASE = [
  'Levantamiento de requerimientos y análisis de arquitectura del módulo backend.',
  'Implementación de rutas RESTful y controladores en Express para gestión de expedientes.',
  'Diseño de esquemas y validaciones de integridad en MongoDB con Mongoose.',
  'Desarrollo de servicios de procesamiento de documentos PDF y validación cruzada.',
  'Integración de pruebas unitarias automatizadas con Jest para endpoints críticos.',
  'Documentación técnica de endpoints y pruebas de integración en colección Postman.',
  'Optimización de consultas a base de datos y manejo centralizado de errores HTTP.',
  'Revisión de código, refactorización de servicios y verificación de reglas de negocio.'
];

function calcularHoraSalida(horaEntrada, horas) {
  const [h, m] = horaEntrada.split(':').map(Number);
  const totalMin = h * 60 + m + Math.round(horas * 60);
  const hh = String(Math.floor(totalMin / 60)).padStart(2, '0');
  const mm = String(totalMin % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function preguntarTexto(pregunta) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) => {
    rl.question(pregunta, (respuesta) => {
      rl.close();
      resolve(respuesta.trim());
    });
  });
}

async function obtenerAulaObjetivo(aulaIdArg) {
  if (aulaIdArg) {
    const aula = await AulaVirtual.findById(aulaIdArg);
    if (!aula) {
      throw new Error(`No se encontró un aula virtual con ID: ${aulaIdArg}`);
    }
    return aula;
  }

  const aulas = await AulaVirtual.find({
    modalidad: MODALIDADES.LABORAL,
    estado: ESTADOS_AULA.ABIERTA
  })
    .sort({ createdAt: -1 })
    .limit(10);

  if (aulas.length === 0) {
    throw new Error('No se encontró ninguna aula virtual laboral abierta');
  }

  if (process.stdin.isTTY) {
    console.log('\nAulas laborales abiertas disponibles:');
    aulas.forEach((a, idx) => {
      console.log(`  [${idx + 1}] ${a._id} - ${a.nombre} (${a.horasRequeridas}h)`);
    });
    const ingresado = await preguntarTexto(
      `\nIngresa el ID del aula (Enter para usar la más reciente: ${aulas[0]._id}): `
    );
    if (ingresado) {
      const aulaElegida = await AulaVirtual.findById(ingresado);
      if (!aulaElegida) {
        throw new Error(`No se encontró un aula virtual con ID: ${ingresado}`);
      }
      return aulaElegida;
    }
  }

  return aulas[0];
}

async function ejecutarSeed(aula) {
  const actividades = await ActividadLaboral.find({ aulaVirtual: aula._id });
  const fechasOcupadas = new Set(
    actividades.map((a) => new Date(a.fecha).toISOString().split('T')[0])
  );

  const horasAprobadas = actividades
    .filter((a) => a.estadoAprobacion === ESTADOS_ACTIVIDAD.APROBADO)
    .reduce((acc, a) => acc + a.horas, 0);

  let horasFaltantes = aula.horasRequeridas - horasAprobadas;
  if (horasFaltantes <= 0) {
    console.log(`[Seed] El aula "${aula.nombre}" ya cumple las ${aula.horasRequeridas}h (${horasAprobadas}h aprobadas).`);
    return;
  }

  const horasPorDia = Math.min(8, Math.max(1, Number(aula.datosEmpresa?.horasDiarias) || 4));
  const inicio = new Date(aula.fechaInicio || Date.now());
  const fin = new Date(aula.fechaFin || Date.now());
  const cursor = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), inicio.getUTCDate()));

  const nuevasActividades = [];
  let idxDesc = 0;

  while (horasFaltantes > 0 && cursor <= fin) {
    const diaSemana = cursor.getUTCDay();
    const fechaIso = cursor.toISOString().split('T')[0];

    if (diaSemana !== 0 && diaSemana !== 6 && !fechasOcupadas.has(fechaIso)) {
      const horasJornada = Math.min(horasPorDia, horasFaltantes);
      const horaEntrada = '08:00';
      const horaSalida = calcularHoraSalida(horaEntrada, horasJornada);

      nuevasActividades.push({
        estudiante: aula.estudiante,
        aulaVirtual: aula._id,
        fecha: new Date(cursor.getTime()),
        horaEntrada,
        horaSalida,
        horas: horasJornada,
        descripcion: DESCRIPCIONES_BASE[idxDesc % DESCRIPCIONES_BASE.length],
        estadoAprobacion: ESTADOS_ACTIVIDAD.APROBADO,
        observacionesDocente: `${MARCA_SEED} Jornada aprobada automáticamente para pruebas`
      });

      fechasOcupadas.add(fechaIso);
      horasFaltantes -= horasJornada;
      idxDesc++;
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  if (nuevasActividades.length === 0) {
    console.log('[Seed] No se encontraron fechas hábiles disponibles dentro del período del aula.');
    return;
  }

  await ActividadLaboral.insertMany(nuevasActividades);
  const totalInsertado = nuevasActividades.reduce((acc, a) => acc + a.horas, 0);
  console.log(
    `[Seed] Insertadas ${nuevasActividades.length} jornadas (${totalInsertado}h) en el aula "${aula.nombre}" (${aula._id}).`
  );
  if (horasFaltantes > 0) {
    console.log(`[Seed] Aviso: Faltaron ${horasFaltantes}h por falta de días hábiles en el rango del aula.`);
  }
}

async function ejecutarRollback(aula) {
  const resultado = await ActividadLaboral.deleteMany({
    aulaVirtual: aula._id,
    observacionesDocente: /^\[SEED\]/
  });

  console.log(
    `[Rollback] Eliminadas ${resultado.deletedCount} jornadas generadas por el seed en el aula "${aula.nombre}" (${aula._id}). Las actividades manuales se conservaron intactas.`
  );
}

async function main() {
  const args = process.argv.slice(2);
  const esRollback = args.includes('--rollback');
  const aulaIdArg = args.find((a) => !a.startsWith('--'));

  await connectDB();
  try {
    const aula = await obtenerAulaObjetivo(aulaIdArg);
    if (esRollback) {
      await ejecutarRollback(aula);
    } else {
      await ejecutarSeed(aula);
    }
  } finally {
    await disconnectDB();
  }
}

main().catch((err) => {
  console.error('[Seed Error]', err.message);
  process.exit(1);
});
