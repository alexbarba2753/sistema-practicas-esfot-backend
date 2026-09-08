import mongoose from 'mongoose';
import { ROLES, ESTADOS_USUARIO } from '../../../domain/constants/practicasConstants.js';

const usuarioSchema = new mongoose.Schema(
  {
    cedula: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    nombres: {
      type: String,
      required: true,
      trim: true
    },
    apellidos: {
      type: String,
      required: true,
      trim: true
    },
    correo: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: true
    },
    rol: {
      type: String,
      enum: Object.values(ROLES),
      default: ROLES.ESTUDIANTE
    },
    telefono: {
      type: String,
      trim: true,
      default: ''
    },
    estado: {
      type: String,
      enum: Object.values(ESTADOS_USUARIO),
      default: ESTADOS_USUARIO.ACTIVO
    },
    resetPasswordToken: {
      type: String,
      default: null
    },
    resetPasswordExpires: {
      type: Date,
      default: null
    }
  },
  {
    collection: 'usuarios',
    timestamps: true
  }
);

// Ocultar password y campos de reseteo al serializar a JSON
usuarioSchema.methods.toJSON = function () {
  const usuario = this.toObject();
  delete usuario.password;
  delete usuario.resetPasswordToken;
  delete usuario.resetPasswordExpires;
  return usuario;
};

export const Usuario = mongoose.model('Usuario', usuarioSchema);
