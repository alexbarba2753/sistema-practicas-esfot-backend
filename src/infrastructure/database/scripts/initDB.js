import { connectDB, disconnectDB } from '../db.js';
import { Usuario } from '../models/Usuario.js';
import { ROLES } from '../../../domain/constants/practicasConstants.js';

export const seedInitialAdmin = async () => {
  const adminExistente = await Usuario.findOne({ rol: ROLES.ADMINISTRADOR });
  if (!adminExistente) {
    const adminBase = new Usuario({
      cedula: '1700000001',
      nombres: 'Administrador',
      apellidos: 'ESFOT Sistema',
      correo: 'admin@epn.edu.ec',
      password: 'AdminPassword123!',
      telefono: '0999999999',
      rol: ROLES.ADMINISTRADOR,
      estado: 'activo'
    });
    await adminBase.save();
    console.log('[Seed] Usuario administrador inicial creado: admin@epn.edu.ec');
  } else {
    console.log(`[Seed] Usuario administrador listo: ${adminExistente.correo}`);
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

    await seedInitialAdmin();

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
