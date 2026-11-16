import mongoose from 'mongoose';
import { MODALIDADES } from '../../../domain/constants/practicasConstants.js';

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
    estado: {
      type: String,
      enum: ['borrador', 'en_revision', 'observado', 'aprobado_docente', 'devuelto_a_tutor', 'pendiente_comision', 'aprobado', 'rechazado'],
      default: 'borrador'
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
      cedulaResponsable: { type: String, default: '' }
    },
    creditosAprobados: {
      type: Number,
      default: 0
    },
    horarioSemanal: {
      horaInicio: { type: String, default: '08:00' },
      horaFin: { type: String, default: '16:30' },
      horasSemanales: { type: Number, default: 40 },
      observacionesFechas: { type: String, default: '' }
    },
    contenidoIa: {
      asignaturasUtilidad: { type: String, default: '' },
      principalesActividades: { type: String, default: '' },
      habilidadesAdquiridas: { type: String, default: '' },
      observacionesTemas: { type: String, default: '' },
      resumenActividades: { type: String, default: '' },
      contribucionConocimientos: { type: String, default: '' },
      resultadosAprendizaje: { type: String, default: '' },
      asignaturasMalla: { type: String, default: '' },
      informeGeneradoTexto: { type: String, default: '' }
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
      observacionesMejora: { type: String, default: '' },
      horasValidadasSugeridas: { type: Number, default: 0 },
      completadoPorTutor: { type: Boolean, default: false },
      fechaRevisionTutor: { type: Date, default: null }
    },
    // Seccion 7 del F_AA_119 / Seccion 10 del FCP_001A (Dictamen del Administrador)
    resolucionComision: {
      avalaAprobacion: { type: Boolean, default: null },
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
