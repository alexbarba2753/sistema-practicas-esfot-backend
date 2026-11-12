import mongoose from 'mongoose';
import { MODALIDADES, ESTADOS_AULA, HORAS_REGLAMENTARIAS } from '../../../domain/constants/practicasConstants.js';

const aulaVirtualSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: [true, 'El nombre del aula es obligatorio'],
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
      required: [true, 'La modalidad es obligatoria']
    },
    docenteTutor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      required: [true, 'El docente tutor es obligatorio']
    },
    // Relacion uno a uno: exactamente un estudiante por aula virtual
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
    },
    documentoInicial: {
      tipo: {
        type: String,
        enum: ['carta_aceptacion', 'formulario_fcp_001a', 'manual'],
        default: 'manual'
      },
      nombreArchivo: { type: String, default: '' },
      textoExtraido: { type: String, default: '' },
      horasExtraidas: { type: Number, default: null }
    },
    datosEmpresa: {
      razonSocial: { type: String, default: '' },
      responsable: { type: String, default: '' },
      cargo: { type: String, default: '' },
      horasDiarias: { type: Number, default: 8 },
      totalHorasPactadas: { type: Number, default: null },
      areaAsignada: { type: String, default: '' }
    }
  },
  {
    collection: 'aulas_virtuales',
    timestamps: true
  }
);

export const AulaVirtual = mongoose.model('AulaVirtual', aulaVirtualSchema);
