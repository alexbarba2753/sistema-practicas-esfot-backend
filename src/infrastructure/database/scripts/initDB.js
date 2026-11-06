import { connectDB, disconnectDB } from '../db.js';
import { Usuario } from '../models/Usuario.js';
import { ROLES } from '../../../domain/constants/practicasConstants.js';

export const seedInitialUsers = async () => {
  // 1. Administrador del sistema
  const adminExistente = await Usuario.findOne({ rol: ROLES.ADMINISTRADOR });
  if (!adminExistente) {
    const adminBase = new Usuario({
      cedula: '1700000001',
      nombres: 'Administrador',
      apellidos: 'ESFOT EPN',
      correo: 'admin@epn.edu.ec',
      password: 'AdminPassword123!',
      telefono: '0999999991',
      rol: ROLES.ADMINISTRADOR,
      estado: 'activo'
    });
    await adminBase.save();
    console.log('[Seed] Usuario administrador base creado: admin@epn.edu.ec');
  } else {
    console.log(`[Seed] Administrador existente: ${adminExistente.correo}`);
  }

  // 2. Docente tutor demo
  const docenteExistente = await Usuario.findOne({ correo: 'docente.demo@epn.edu.ec' });
  if (!docenteExistente) {
    const docenteBase = new Usuario({
      cedula: '1700000002',
      nombres: 'Docente',
      apellidos: 'Tutor ESFOT',
      correo: 'docente.demo@epn.edu.ec',
      password: 'DocentePassword123!',
      telefono: '0999999992',
      rol: ROLES.DOCENTE,
      estado: 'activo'
    });
    await docenteBase.save();
    console.log('[Seed] Docente tutor demo creado: docente.demo@epn.edu.ec');
  }

  // 3. Estudiante demo
  const estudianteExistente = await Usuario.findOne({ correo: 'estudiante.demo@epn.edu.ec' });
  if (!estudianteExistente) {
    const estudianteBase = new Usuario({
      cedula: '1700000003',
      nombres: 'Estudiante',
      apellidos: 'Practicante ESFOT',
      correo: 'estudiante.demo@epn.edu.ec',
      password: 'EstudiantePassword123!',
      telefono: '0999999993',
      rol: ROLES.ESTUDIANTE,
      estado: 'activo'
    });
    await estudianteBase.save();
    console.log('[Seed] Estudiante demo creado: estudiante.demo@epn.edu.ec');
  }
};

export const initDatabase = async () => {
  try {
    console.log('Iniciando configuracion e inicializacion de colecciones en MongoDB');
    const conn = await connectDB();
    const db = conn.connection.db;

    const coleccionesEsperadas = [
      'usuarios',
      'aulas_virtuales',
      'actividades_laborales',
      'actividades_comunitarias',
      'convalidaciones_certificados',
      'fuentes_institucionales',
      'formularios_pendientes',
      'formularios_aprobacion'
    ];

    const coleccionesExistentes = await db.listCollections().toArray();
    const nombresExistentes = coleccionesExistentes.map((c) => c.name);

    for (const coleccion of coleccionesEsperadas) {
      if (!nombresExistentes.includes(coleccion)) {
        await db.createCollection(coleccion);
        console.log(`(+) Coleccion creada con exito: ${coleccion}`);
      }
    }

    await seedInitialUsers();

    await disconnectDB();
    console.log('Inicializacion completada con exito.');
  } catch (error) {
    console.error('Error durante la inicializacion de la base de datos:', error.message);
    throw error;
  }
};

const isDirectRun = process.argv[1] && (
  process.argv[1].endsWith('initDB.js') || 
  process.argv[1].endsWith('initDB')
);

if (isDirectRun) {
  initDatabase().then(() => process.exit(0)).catch(() => process.exit(1));
}
