import mongoose from 'mongoose';
import { crearDefinicionFormulario } from './FormularioPendiente.js';

const formularioAprobacionSchema = new mongoose.Schema(crearDefinicionFormulario(), {
  collection: 'formularios_aprobados',
  timestamps: true
});

export const FormularioAprobacion = mongoose.model('FormularioAprobacion', formularioAprobacionSchema);
