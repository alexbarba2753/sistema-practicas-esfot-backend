import mongoose from 'mongoose';
import { MODALIDADES, ESTADOS_AULA, HORAS_REGLAMENTARIAS } from '../../../domain/constants/practicasConstants.js';

const aulaConvalidacionSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: [true, 'El nombre del aula de convalidacion es obligatorio'],
      trim: true
    },
    periodo: {
      type: String,
      required: [true, 'El periodo academico es obligatorio'],
      trim: true
    },
    modalidad: {
      type: String,
      enum: Object.values(MODALIDADES),
      required: [true, 'La modalidad (laboral o comunitario) es obligatoria']
    },
    carrera: {
      type: String,
      trim: true,
      default: 'Desarrollo de Software'
    },
    docenteTutor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      required: [true, 'El docente tutor es obligatorio']
    },
    estudiante: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      default: null
    },
    horasRequeridas: {
      type: Number,
      default: function () {
        return this.modalidad === MODALIDADES.LABORAL
          ? HORAS_REGLAMENTARIAS.LABORAL
          : HORAS_REGLAMENTARIAS.COMUNITARIO;
      }
    },
    fechaInicio: {
      type: Date,
      default: Date.now
    },
    fechaFin: {
      type: Date,
      required: [true, 'La fecha fin o limite es obligatoria']
    },
    estado: {
      type: String,
      enum: Object.values(ESTADOS_AULA),
      default: ESTADOS_AULA.ABIERTA
    },
    expedienteEntregado: {
      type: Boolean,
      default: false
    },
    fechaEntregaExpediente: {
      type: Date,
      default: null
    }
  },
  {
    collection: 'aulas_virtuales_convalidacion',
    timestamps: true
  }
);

export const AulaConvalidacion = mongoose.model('AulaConvalidacion', aulaConvalidacionSchema);
