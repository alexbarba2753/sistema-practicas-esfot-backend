import mongoose from 'mongoose';
import { MODALIDADES } from '../../../domain/constants/practicasConstants.js';

const formularioAprobacionSchema = new mongoose.Schema(
  {
    estudiante: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true
    },
    docenteTutor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true
    },
    aulaVirtual: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AulaVirtual',
      required: true
    },
    modalidad: {
      type: String,
      enum: Object.values(MODALIDADES),
      required: true
    },
    horasCompletadas: {
      type: Number,
      required: true,
      min: 0
    },
    horasRequeridas: {
      type: Number,
      required: true
    },
    dictamen: {
      type: String,
      enum: ['Aprobado', 'No Aprobado'],
      default: 'Aprobado'
    },
    observaciones: {
      type: String,
      trim: true,
      default: ''
    },
    estado: {
      type: String,
      enum: ['aprobado', 'rechazado'],
      default: 'aprobado'
    },
    aprobadoPorAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      default: null
    },
    fechaEmision: {
      type: Date,
      default: Date.now
    }
  },
  {
    collection: 'formularios_aprobados',
    timestamps: true
  }
);

export const FormularioAprobacion = mongoose.model('FormularioAprobacion', formularioAprobacionSchema);
