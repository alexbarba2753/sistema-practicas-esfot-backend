import mongoose from 'mongoose';
import { MODALIDADES } from '../../../domain/constants/practicasConstants.js';

const bloqueHorarioSchema = new mongoose.Schema(
  {
    horaInicio: { type: String, required: true, trim: true },
    horaFin: { type: String, required: true, trim: true }
  },
  { _id: false }
);

const horarioSemanalSchema = new mongoose.Schema(
  {
    lunes: { type: [bloqueHorarioSchema], default: [] },
    martes: { type: [bloqueHorarioSchema], default: [] },
    miercoles: { type: [bloqueHorarioSchema], default: [] },
    jueves: { type: [bloqueHorarioSchema], default: [] },
    viernes: { type: [bloqueHorarioSchema], default: [] },
    sabado: { type: [bloqueHorarioSchema], default: [] },
    domingo: { type: [bloqueHorarioSchema], default: [] },
    horasSemanales: { type: Number, default: 0 },
    horasProyectadas: { type: Number, default: 0 },
    observacionesFechas: { type: String, default: '' }
  },
  { _id: false }
);

export function crearDefinicionFormulario() {
  return {
    aulaVirtual: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AulaVirtual',
      required: true,
      unique: true,
      index: true
    },
    estudiante: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true,
      index: true
    },
    modalidad: {
      type: String,
      enum: Object.values(MODALIDADES),
      required: true
    },
    tipoAula: {
      type: String,
      enum: ['laboral', 'convalidacion'],
      default: 'laboral'
    },
    estado: {
      type: String,
      enum: ['borrador', 'en_revision', 'observado', 'aprobado_docente', 'devuelto_a_tutor', 'pendiente_comision', 'aprobado', 'rechazado'],
      default: 'borrador'
    },
    documentacionSoporte: {
      type: String,
      default: undefined
    },
    seccion1y2Marcas: {
      type: [String],
      default: undefined
    },
    entidadReceptora: {
      razonSocial: { type: String, default: '' },
      ruc: { type: String, default: '' },
      direccion: { type: String, default: '' },
      correo: { type: String, default: '' },
      ciudad: { type: String, default: 'Quito' },
      telefono: { type: String, default: '' },
      celular: { type: String, default: '' },
      tipoEntidad: { type: String, default: 'Privada' },
      responsable: { type: String, default: '' },
      areaAsignada: { type: String, default: '' },
      cedulaResponsable: { type: String, default: undefined },
      campoAmplio: { type: String, default: undefined },
      campoEspecifico: { type: String, default: undefined },
      codigoProyecto: { type: String, default: undefined },
      nombreProyecto: { type: String, default: undefined }
    },
    creditosAprobados: {
      type: Number,
      default: undefined
    },
    fechaDeclaracion: {
      type: Date,
      default: undefined
    },
    horarioSemanal: {
      type: horarioSemanalSchema,
      default: undefined
    },
    contenidoIa: {
      asignaturasUtilidad: { type: String, default: undefined },
      principalesActividades: { type: String, default: undefined },
      habilidadesAdquiridas: { type: String, default: undefined },
      observacionesTemas: { type: String, default: undefined },
      resumenActividades: { type: String, default: undefined },
      contribucionConocimientos: { type: String, default: undefined },
      resultadosAprendizaje: { type: String, default: undefined },
      asignaturasMalla: { type: String, default: undefined }
    },
    // Seccion 6 del F_AA_119 / Seccion 9 del FCP_001A (Seguimiento obligatorio del Tutor EPN)
    seguimientoTutor: {
      conformidadPlan: { type: Boolean, default: true },
      observacionesPlan: { type: String, default: 'Las actividades realizadas se cumplen según lo planificado al inicio de la práctica.' },
      novedades: { type: String, default: 'Las prácticas preprofesionales se llevaron a cabo con normalidad.' },
      actividadesSeguimiento: [
        {
          actividad: { type: String, required: true },
          fecha: { type: Date, default: Date.now },
          resultados: { type: String, default: '' }
        }
      ],
      evaluacionCualitativaTutor: {
        recomiendaEntidad: { type: Boolean, default: true },
        aportaPerfilEgreso: { type: Boolean, default: true },
        recomiendaAprobacion: { type: Boolean, default: true }
      },
      unidadAcademica: { type: String, default: undefined },
      observacionesMejora: { type: String, default: '' },
      horasValidadasSugeridas: { type: Number, default: 0 },
      completadoPorTutor: { type: Boolean, default: false },
      fechaRevisionTutor: { type: Date, default: null }
    },
    // Seccion 7 del F_AA_119 / Seccion 10 del FCP_001A (Dictamen del Administrador)
    resolucionComision: {
      avalaAprobacion: { type: Boolean, default: null },
      horasAprobadasLaborales: { type: Number, default: undefined },
      horasAprobadasComunitarias: { type: Number, default: undefined },
      observacionesComision: { type: String, default: '' },
      fechaResolucion: { type: Date, default: null },
      revisadoPorAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null }
    },
    totalHoras: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    fechaGeneracionIa: {
      type: Date,
      default: Date.now
    },
    ultimaEdicionEstudiante: {
      type: Date,
      default: null
    }
  };
}

const formularioPendienteSchema = new mongoose.Schema(crearDefinicionFormulario(), {
  collection: 'formularios_pendientes',
  timestamps: true
});

export const FormularioPendiente = mongoose.model('FormularioPendiente', formularioPendienteSchema);
