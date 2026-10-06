import mongoose from 'mongoose';
import { MODALIDADES } from '../../../domain/constants/practicasConstants.js';

const formularioPendienteSchema = new mongoose.Schema(
  {
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
      enum: ['borrador', 'en_revision', 'aprobado'],
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
      tutorEmpresarial: { type: String, default: '' },
      areaAsignada: { type: String, default: '' }
    },
    horarioSemanal: {
      horaInicio: { type: String, default: '08:00' },
      horaFin: { type: String, default: '16:30' },
      horasSemanales: { type: Number, default: 40 }
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
  },
  {
    collection: 'formularios_pendientes',
    timestamps: true
  }
);

export const FormularioPendiente = mongoose.model('FormularioPendiente', formularioPendienteSchema);
