import mongoose from 'mongoose';
import { ESTADOS_ACTIVIDAD } from '../../../domain/constants/practicasConstants.js';

const actividadComunitariaSchema = new mongoose.Schema(
  {
    estudiante: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true
    },
    aulaVirtual: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AulaVirtual',
      required: true
    },
    fecha: {
      type: Date,
      required: [true, 'La fecha de la actividad comunitaria es obligatoria'],
      default: Date.now
    },
    horas: {
      type: Number,
      required: [true, 'El total de horas cumplidas es obligatorio'],
      min: [1, 'Minimo 1 hora'],
      max: [96, 'No puede superar el tope de 96 horas reglamentarias']
    },
    comunidadOInstitucion: {
      type: String,
      required: [true, 'El nombre de la comunidad o institucion beneficiaria es obligatorio'],
      trim: true
    },
    beneficiariosAproximados: {
      type: Number,
      default: 0,
      min: 0
    },
    descripcion: {
      type: String,
      required: [true, 'La descripcion de las actividades es obligatoria'],
      trim: true
    },
    archivoEvidenciaUrl: {
      type: String,
      trim: true,
      default: ''
    },
    estadoAprobacion: {
      type: String,
      enum: Object.values(ESTADOS_ACTIVIDAD),
      default: ESTADOS_ACTIVIDAD.PENDIENTE
    },
    observacionesDocente: {
      type: String,
      trim: true,
      default: ''
    }
  },
  {
    collection: 'actividades_comunitarias',
    timestamps: true
  }
);

export const ActividadComunitaria = mongoose.model('ActividadComunitaria', actividadComunitariaSchema);
