import mongoose from 'mongoose';

const convalidacionCertificadoSchema = new mongoose.Schema(
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
    plataforma: {
      type: String,
      required: [true, 'La plataforma emisora es obligatoria (Udemy, Cisco, Google, Coursera, etc.)'],
      trim: true
    },
    nombreCurso: {
      type: String,
      required: [true, 'El nombre del curso o certificacion es obligatorio'],
      trim: true
    },
    codigoCertificado: {
      type: String,
      trim: true,
      default: ''
    },
    horasCertificadas: {
      type: Number,
      required: [true, 'Las horas certificadas son obligatorias'],
      min: [1, 'Minimo 1 hora']
    },
    horasAcreditadas: {
      type: Number,
      default: 0
    },
    enlaceCredencial: {
      type: String,
      trim: true,
      default: ''
    },
    estado: {
      type: String,
      enum: ['pendiente', 'aprobada', 'rechazada'],
      default: 'pendiente'
    },
    observacionesDocente: {
      type: String,
      trim: true,
      default: ''
    }
  },
  {
    collection: 'convalidaciones_certificados',
    timestamps: true
  }
);

export const ConvalidacionCertificado = mongoose.model('ConvalidacionCertificado', convalidacionCertificadoSchema);
