import bcrypt from 'bcryptjs';
import { Usuario } from '../../infrastructure/database/models/Usuario.js';
import { ROLES, ESTADOS_USUARIO } from '../../domain/constants/practicasConstants.js';
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
    const { cedula, nombres, apellidos, correo, password, rol, telefono, estado } = datos;

    if (!cedula || !validarCedula(cedula)) {
      throw errorHttp('El numero de cedula ingresado es invalido', 400);
    }

    if (!nombres || !apellidos || !correo || !password) {
      throw errorHttp('Nombres, apellidos, correo y password son obligatorios', 400);
    }

    const existeCorreo = await this.buscarPorCorreo(correo);
    if (existeCorreo) {
      throw errorHttp('Ya existe un usuario registrado con ese correo institucional', 409);
    }

    const existeCedula = await this.buscarPorCedula(cedula);
    if (existeCedula) {
      throw errorHttp('Ya existe un usuario registrado con ese numero de cedula', 409);
    }

    if (rol && !Object.values(ROLES).includes(rol)) {
      throw errorHttp(`Rol no valido. Permitidos: ${Object.values(ROLES).join(', ')}`, 400);
    }

    const passwordHash = await this.hashearPassword(password);

    const nuevoUsuario = new Usuario({
      cedula: cedula.trim(),
      nombres: nombres.trim(),
      apellidos: apellidos.trim(),
      correo: correo.toLowerCase().trim(),
      password: passwordHash,
      rol: rol || ROLES.ESTUDIANTE,
      estado: estado || ESTADOS_USUARIO.ACTIVO,
      telefono: telefono ? telefono.trim() : ''
    });

    await nuevoUsuario.save();
    return nuevoUsuario;
  },

  async listarUsuarios(filtros = {}) {
    const query = {};

    if (filtros.rol && Object.values(ROLES).includes(filtros.rol)) {
      query.rol = filtros.rol;
    }

    if (filtros.estado && Object.values(ESTADOS_USUARIO).includes(filtros.estado)) {
      query.estado = filtros.estado;
    }

    if (filtros.busqueda) {
      const regex = new RegExp(filtros.busqueda.trim(), 'i');
      query.$or = [{ nombres: regex }, { apellidos: regex }, { cedula: regex }, { correo: regex }];
    }

    return await Usuario.find(query)
      .select('-password -token -tokenExpires')
      .sort({ createdAt: -1 });
  },

  async obtenerUsuarioPorId(id) {
    const usuario = await Usuario.findById(id).select('-password -token -tokenExpires');
    if (!usuario) {
      throw errorHttp('Usuario no encontrado', 404);
    }
    return usuario;
  },

  async actualizar(id, datos) {
    const usuario = await this.buscarPorId(id);

    if (datos.nombres) usuario.nombres = datos.nombres.trim();
    if (datos.apellidos) usuario.apellidos = datos.apellidos.trim();
    if (datos.telefono !== undefined) usuario.telefono = datos.telefono.trim();
    if (datos.rol && Object.values(ROLES).includes(datos.rol)) usuario.rol = datos.rol;
    if (datos.estado && Object.values(ESTADOS_USUARIO).includes(datos.estado)) usuario.estado = datos.estado;

    await usuario.save();
    return await this.obtenerUsuarioPorId(id);
  },

  async cambiarEstadoUsuario(id, nuevoEstado) {
    if (!Object.values(ESTADOS_USUARIO).includes(nuevoEstado)) {
      throw errorHttp('Estado no valido. Debe ser activo o inactivo', 400);
    }

    const usuario = await this.buscarPorId(id);
    usuario.estado = nuevoEstado;
    await usuario.save();

    return await this.obtenerUsuarioPorId(id);
  }
};
