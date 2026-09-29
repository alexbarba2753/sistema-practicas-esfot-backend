import { AulaVirtual } from '../../infrastructure/database/models/AulaVirtual.js';
import { Usuario } from '../../infrastructure/database/models/Usuario.js';
import { MODALIDADES, ROLES, ESTADOS_AULA, HORAS_REGLAMENTARIAS } from '../../domain/constants/practicasConstants.js';
import { errorHttp } from '../../domain/utils/errorHttp.js';

export const aulaService = {
  // Crea y parametriza un aula virtual garantizando la relacion 1 a 1 entre docente y estudiante
  async crearAula(datos) {
    const { nombre, periodo, modalidad, docenteTutor, estudiante, fechaInicio, fechaFin } = datos;

    if (!nombre || !periodo || !modalidad || !docenteTutor || !estudiante || !fechaFin) {
      throw errorHttp('Nombre, periodo, modalidad, docente tutor, estudiante y fecha fin son obligatorios', 400);
    }

    if (!Object.values(MODALIDADES).includes(modalidad)) {
      throw errorHttp(`Modalidad no valida. Permitidas: ${Object.values(MODALIDADES).join(', ')}`, 400);
    }

    // Verificar docente tutor
    const tutor = await Usuario.findById(docenteTutor);
    if (!tutor || tutor.rol !== ROLES.DOCENTE) {
      throw errorHttp('El docente tutor asignado no existe o no tiene el rol de docente', 400);
    }

    // Verificar estudiante
    const alumno = await Usuario.findById(estudiante);
    if (!alumno || alumno.rol !== ROLES.ESTUDIANTE) {
      throw errorHttp('El estudiante asignado no existe o no tiene el rol de estudiante', 400);
    }

    // Regla de negocio: El estudiante no puede tener otra aula activa en la misma modalidad
    const aulaActiva = await AulaVirtual.findOne({
      estudiante: alumno._id,
      modalidad,
      estado: ESTADOS_AULA.ABIERTA
    });
    if (aulaActiva) {
      throw errorHttp(`El estudiante ya cuenta con un aula virtual activa para la modalidad '${modalidad}'`, 409);
    }

    const fInicio = fechaInicio ? new Date(fechaInicio) : new Date();
    const fFin = new Date(fechaFin);
    if (isNaN(fFin.getTime()) || fFin <= fInicio) {
      throw errorHttp('La fecha fin debe ser valida y posterior a la fecha de inicio', 400);
    }

    const horasRequeridas = modalidad === MODALIDADES.LABORAL
      ? HORAS_REGLAMENTARIAS.LABORAL
      : HORAS_REGLAMENTARIAS.COMUNITARIO;

    const nuevaAula = new AulaVirtual({
      nombre: nombre.trim(),
      periodo: periodo.trim(),
      modalidad,
      docenteTutor: tutor._id,
      estudiante: alumno._id,
      horasRequeridas,
      fechaInicio: fInicio,
      fechaFin: fFin,
      estado: ESTADOS_AULA.ABIERTA
    });

    await nuevaAula.save();

    return await this.obtenerAulaPorId(nuevaAula._id);
  },

  async listarAulas(filtros = {}) {
    const query = {};

    if (filtros.periodo) query.periodo = new RegExp(filtros.periodo.trim(), 'i');
    if (filtros.modalidad && Object.values(MODALIDADES).includes(filtros.modalidad)) query.modalidad = filtros.modalidad;
    if (filtros.estado && Object.values(ESTADOS_AULA).includes(filtros.estado)) query.estado = filtros.estado;
    if (filtros.docenteTutor) query.docenteTutor = filtros.docenteTutor;
    if (filtros.estudiante) query.estudiante = filtros.estudiante;

    return await AulaVirtual.find(query)
      .populate('docenteTutor', 'nombres apellidos correo telefono')
      .populate('estudiante', 'nombres apellidos correo cedula telefono estado')
      .select('-__v')
      .sort({ createdAt: -1 });
  },

  async obtenerAulaPorId(id) {
    const aula = await AulaVirtual.findById(id)
      .populate('docenteTutor', 'nombres apellidos correo telefono')
      .populate('estudiante', 'nombres apellidos correo cedula telefono estado')
      .select('-__v');

    if (!aula) {
      throw errorHttp('Aula virtual no encontrada', 404);
    }
    return aula;
  },

  async actualizarAula(id, datos) {
    const aula = await AulaVirtual.findById(id);
    if (!aula) throw errorHttp('Aula virtual no encontrada', 404);

    if (datos.nombre) aula.nombre = datos.nombre.trim();
    if (datos.periodo) aula.periodo = datos.periodo.trim();
    if (datos.fechaFin) {
      const fFin = new Date(datos.fechaFin);
      if (isNaN(fFin.getTime()) || fFin <= aula.fechaInicio) {
        throw errorHttp('La fecha limite debe ser valida y posterior al inicio', 400);
      }
      aula.fechaFin = fFin;
    }

    if (datos.docenteTutor) {
      const tutor = await Usuario.findById(datos.docenteTutor);
      if (!tutor || tutor.rol !== ROLES.DOCENTE) {
        throw errorHttp('El nuevo docente tutor asignado no es valido', 400);
      }
      aula.docenteTutor = tutor._id;
    }

    await aula.save();
    return await this.obtenerAulaPorId(id);
  },

  async cambiarEstadoAula(id, nuevoEstado) {
    if (!Object.values(ESTADOS_AULA).includes(nuevoEstado)) {
      throw errorHttp(`Estado no valido. Permitidos: ${Object.values(ESTADOS_AULA).join(', ')}`, 400);
    }

    const aula = await AulaVirtual.findById(id);
    if (!aula) throw errorHttp('Aula virtual no encontrada', 404);

    aula.estado = nuevoEstado;
    await aula.save();
    return await this.obtenerAulaPorId(id);
  },

  async asignarEstudiante(aulaId, estudianteId) {
    const aula = await AulaVirtual.findById(aulaId);
    if (!aula) throw errorHttp('Aula virtual no encontrada', 404);

    const alumno = await Usuario.findById(estudianteId);
    if (!alumno || alumno.rol !== ROLES.ESTUDIANTE) {
      throw errorHttp('El usuario no existe o no tiene rol de estudiante', 400);
    }

    const aulaActiva = await AulaVirtual.findOne({
      estudiante: alumno._id,
      modalidad: aula.modalidad,
      estado: ESTADOS_AULA.ABIERTA,
      _id: { $ne: aula._id }
    });
    if (aulaActiva) {
      throw errorHttp('El estudiante ya esta asignado a otra aula activa en esta misma modalidad', 409);
    }

    aula.estudiante = alumno._id;
    await aula.save();
    return await this.obtenerAulaPorId(aulaId);
  },

  async desasignarEstudiante(aulaId) {
    const aula = await AulaVirtual.findById(aulaId);
    if (!aula) throw errorHttp('Aula virtual no encontrada', 404);

    aula.estudiante = null;
    await aula.save();
    return await this.obtenerAulaPorId(aulaId);
  }
};
