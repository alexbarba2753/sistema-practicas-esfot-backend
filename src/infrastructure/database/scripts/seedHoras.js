import { connectDB, disconnectDB } from '../db.js';
import { Usuario } from '../models/Usuario.js';
import { AulaVirtual } from '../models/AulaVirtual.js';
import { ActividadLaboral } from '../models/ActividadLaboral.js';
import { ActividadComunitaria } from '../models/ActividadComunitaria.js';
import { FormularioPendiente } from '../models/FormularioPendiente.js';
import { FormularioAprobacion } from '../models/FormularioAprobacion.js';
import { ROLES, ESTADOS_AULA, ESTADOS_ACTIVIDAD, MODALIDADES } from '../../../domain/constants/practicasConstants.js';

const TAREAS_LABORALES = [
  'Levantamiento de requerimientos funcionales y diseno de diagramas de arquitectura de software.',
  'Configuracion del entorno de desarrollo local con Node.js, Express y control de versiones Git.',
  'Diseno del modelo entidad-relacion y esquemas de colecciones en MongoDB Atlas.',
  'Implementacion de scripts de inicializacion y conexion a la base de datos con Mongoose.',
  'Desarrollo del modulo de autenticacion de usuarios mediante tokens JSON Web Tokens (JWT).',
  'Implementacion de cifrado seguro de credenciales de usuario con la libreria bcryptjs.',
  'Construccion de middlewares para validacion de cabeceras de autorizacion y tokens expirados.',
  'Diseno y desarrollo de endpoints RESTful para la gestion del perfil de usuario.',
  'Implementacion de servicio de envio de correos transaccionales para verificacion de cuentas.',
  'Desarrollo del flujo de recuperacion de contrasena con tokens de un solo uso.',
  'Creacion de capa de servicios y separacion de responsabilidades bajo arquitectura limpia.',
  'Implementacion de validacion de datos de entrada y manejo centralizado de excepciones HTTP.',
  'Desarrollo de controladores y rutas para la administracion de aulas virtuales institucionales.',
  'Construccion de endpoints para asignacion de docentes tutores y matriculacion de estudiantes.',
  'Implementacion de bitacoras diarias de actividades laborales con validacion de jornada de 8h.',
  'Desarrollo del servicio de calculo y auditoria de horas acumuladas en tiempo real.',
  'Diseno e integracion de consultas de agregacion en MongoDB para estadisticas de progreso.',
  'Implementacion de filtros de seguridad por roles (RBAC) para perfiles Estudiante y Administrador.',
  'Desarrollo del servicio de consulta normativa institucional mediante modelo RAG con Groq LLaMA 3.',
  'Indexacion de documentos reglamentarios oficiales de la ESFOT en la base de conocimientos.',
  'Optimizacion del prompt del asistente de IA para evitar alucinaciones y citar normativa oficial.',
  'Diseno de pruebas de integracion con Supertest para verificar el ciclo de vida de los endpoints.',
  'Depuracion de consultas a la base de datos e implementacion de indices para mejorar rendimiento.',
  'Refactorizacion de controladores para desacoplar logica de negocio hacia la capa de aplicacion.',
  'Configuracion de variables de entorno seguras para produccion y entornos de prueba.',
  'Pruebas de carga y auditoria de seguridad en la transmision de tokens y cabeceras CORS.',
  'Elaboracion de la coleccion de pruebas en Postman con scripts de extraccion dinamica de variables.',
  'Correccion de errores reportados en la validacion cruzada entre modalidades de practicas.',
  'Generacion automatizada de borradores de informes tecnicos de convalidacion con IA.',
  'Revision final de codigo, documentacion tecnica del repositorio y preparacion para entrega formal.'
];

export async function sembrarDatosDemo() {
  try {
    console.log('Iniciando carga de datos demo para pruebas del sistema');
    await connectDB();

    const CORREO_DEMO_ESTUDIANTE = 'estudiante.demo@epn.edu.ec';
    const CORREO_DEMO_DOCENTE = 'docente.demo@epn.edu.ec';

    let estudiante = await Usuario.findOne({ correo: CORREO_DEMO_ESTUDIANTE });
    if (!estudiante) {
      estudiante = await Usuario.create({
        cedula: '1700000003',
        nombres: 'Estudiante',
        apellidos: 'Practicante ESFOT',
        correo: CORREO_DEMO_ESTUDIANTE,
        password: 'EstudiantePassword123!',
        telefono: '0999999993',
        rol: ROLES.ESTUDIANTE,
        estado: 'activo'
      });
    }

    let docente = await Usuario.findOne({ correo: CORREO_DEMO_DOCENTE });
    if (!docente) {
      docente = await Usuario.create({
        cedula: '1700000002',
        nombres: 'Docente',
        apellidos: 'Tutor ESFOT',
        correo: CORREO_DEMO_DOCENTE,
        password: 'DocentePassword123!',
        telefono: '0999999992',
        rol: ROLES.DOCENTE,
        estado: 'activo'
      });
    }

    // Limpieza de datos demo de pruebas previas
    const aulasExistentes = await AulaVirtual.find({ estudiante: estudiante._id });
    for (const a of aulasExistentes) {
      await ActividadLaboral.deleteMany({ aulaVirtual: a._id });
      await ActividadComunitaria.deleteMany({ aulaVirtual: a._id });
      await FormularioPendiente.deleteMany({ aulaVirtual: a._id });
      await FormularioAprobacion.deleteMany({ aulaVirtual: a._id });
    }
    await AulaVirtual.deleteMany({ estudiante: estudiante._id });

    // Crear aula 1 a 1 de modalidad laboral
    const aulaLaboral = await AulaVirtual.create({
      nombre: 'Prácticas Laborales - Desarrollo Backend ESFOT',
      periodo: '2026-A',
      modalidad: MODALIDADES.LABORAL,
      horasRequeridas: 240,
      fechaInicio: new Date('2026-06-01'),
      fechaFin: new Date('2026-08-31'),
      docenteTutor: docente._id,
      estudiante: estudiante._id,
      estado: ESTADOS_AULA.ABIERTA
    });

    console.log(`Aula virtual creada: ${aulaLaboral.nombre} (${aulaLaboral._id})`);

    // Sembrar 30 actividades de 8 horas = 240 horas
    const actividadesParaInsertar = [];
    const fechaBase = new Date('2026-06-01T08:00:00Z');

    for (let i = 0; i < TAREAS_LABORALES.length; i++) {
      const fechaAct = new Date(fechaBase);
      fechaAct.setDate(fechaAct.getDate() + i);

      actividadesParaInsertar.push({
        estudiante: estudiante._id,
        aulaVirtual: aulaLaboral._id,
        fecha: fechaAct,
        horas: 8,
        descripcion: TAREAS_LABORALES[i],
        estado: ESTADOS_ACTIVIDAD.APROBADA,
        evaluadoPor: docente._id,
        fechaEvaluacion: new Date()
      });
    }

    await ActividadLaboral.insertMany(actividadesParaInsertar);
    console.log(`Insertadas 30 actividades laborales aprobadas (240 horas en total).`);

    await disconnectDB();
    console.log('Carga demo completada exitosamente.');
  } catch (error) {
    console.error('Error al sembrar datos demo:', error.message);
    throw error;
  }
}

const isDirectRun = process.argv[1] && (
  process.argv[1].endsWith('seedHoras.js') || 
  process.argv[1].endsWith('seedHoras')
);

if (isDirectRun) {
  sembrarDatosDemo().then(() => process.exit(0)).catch(() => process.exit(1));
}
