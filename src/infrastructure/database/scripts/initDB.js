import bcrypt from 'bcryptjs';
import { connectDB, disconnectDB } from '../db.js';
import { Usuario } from '../models/Usuario.js';
import { ROLES } from '../../../domain/constants/practicasConstants.js';

export const seedInitialAdmin = async () => {
  const correoAdmin = 'admin@esfot.epn.edu.ec';
  const passwordAdmin = 'AdminPassword123!';

  let admin = await Usuario.findOne({
    $or: [{ correo: correoAdmin }, { rol: ROLES.ADMINISTRADOR }]
  });

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(passwordAdmin, salt);

  if (!admin) {
    admin = new Usuario({
      cedula: '1700000001',
      nombres: 'Administrador',
      apellidos: 'ESFOT Sistema',
      correo: correoAdmin,
      password: passwordHash,
      telefono: '0999999999',
      rol: ROLES.ADMINISTRADOR,
      estado: 'activo'
    });
    await admin.save();
    console.log(`[Seed] Usuario administrador inicial creado: ${correoAdmin}`);
  } else {
    admin.correo = correoAdmin;
    admin.password = passwordHash;
    admin.estado = 'activo';
    await admin.save();
    console.log(`[Seed] Usuario administrador listo: ${correoAdmin}`);
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
