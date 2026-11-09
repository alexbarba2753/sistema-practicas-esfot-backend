import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
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
    token: {
      type: String,
      default: null
    },
    tokenExpiracion: {
      type: Date,
      default: null
    }
  },
  {
    collection: 'usuarios',
    timestamps: true
  }
);

// Cifrar la contrasena antes de guardarla si fue modificada o es nueva
usuarioSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  if (typeof this.password === 'string' && /^\$2[ab]\$\d{2}\$/.test(this.password)) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Ocultar password y token temporal al serializar a JSON
usuarioSchema.methods.toJSON = function () {
  const usuario = this.toObject();
  delete usuario.password;
  delete usuario.token;
  delete usuario.tokenExpiracion;
  return usuario;
};

export const Usuario = mongoose.model('Usuario', usuarioSchema);
