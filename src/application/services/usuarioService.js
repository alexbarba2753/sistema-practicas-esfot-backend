import bcrypt from 'bcryptjs';
import { Usuario } from '../../infrastructure/database/models/Usuario.js';
import { errorHttp } from '../../domain/utils/errorHttp.js';
import { validarCedula } from '../../domain/utils/validarCedula.js';

export const usuarioService = {
  async buscarPorId(id) {
    const usuario = await Usuario.findById(id);
    if (!usuario) throw errorHttp('Usuario no encontrado', 404);
    return usuario;
  },

  async buscarPorCorreo(correo) {
    if (!correo) return null;
    return await Usuario.findOne({ correo: correo.toLowerCase().trim() });
  },

  async buscarPorCedula(cedula) {
    if (!cedula) return null;
    return await Usuario.findOne({ cedula: cedula.trim() });
  },

  async hashearPassword(password) {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
  },

  async compararPassword(passwordPlano, passwordHash) {
    return await bcrypt.compare(passwordPlano, passwordHash);
  },

  async crear(datos) {
    const { cedula, nombres, apellidos, correo, password, rol, telefono } = datos;

    if (!cedula || !validarCedula(cedula)) {
      throw errorHttp('El número de cédula ingresado es inválido', 400);
    }

    const existeCorreo = await this.buscarPorCorreo(correo);
    if (existeCorreo) {
      throw errorHttp('Ya existe un usuario registrado con ese correo institucional', 400);
    }

    const existeCedula = await this.buscarPorCedula(cedula);
    if (existeCedula) {
      throw errorHttp('Ya existe un usuario registrado con ese número de cédula', 400);
    }

    const passwordHash = await this.hashearPassword(password);

    const nuevoUsuario = new Usuario({
      cedula: cedula.trim(),
      nombres: nombres.trim(),
      apellidos: apellidos.trim(),
      correo: correo.toLowerCase().trim(),
      password: passwordHash,
      rol: rol || 'estudiante',
      telefono: telefono ? telefono.trim() : ''
    });

    await nuevoUsuario.save();
    return nuevoUsuario;
  },

  async actualizar(id, datos) {
    const usuario = await this.buscarPorId(id);

    if (datos.nombres) usuario.nombres = datos.nombres.trim();
    if (datos.apellidos) usuario.apellidos = datos.apellidos.trim();
    if (datos.telefono !== undefined) usuario.telefono = datos.telefono.trim();

    await usuario.save();
    return usuario;
  }
};
