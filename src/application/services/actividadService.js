import { AulaVirtual } from '../../infrastructure/database/models/AulaVirtual.js';
import { ActividadLaboral } from '../../infrastructure/database/models/ActividadLaboral.js';
import { ActividadComunitaria } from '../../infrastructure/database/models/ActividadComunitaria.js';
import { ConvalidacionCertificado } from '../../infrastructure/database/models/ConvalidacionCertificado.js';
import { ESTADOS_ACTIVIDAD, ESTADOS_AULA, MODALIDADES } from '../../domain/constants/practicasConstants.js';
import { errorHttp } from '../../domain/utils/errorHttp.js';
import { validarJornadaLaboral, validarActividadComunitariaDatos } from '../../domain/utils/validarActividad.js';

export const actividadService = {
  // Calcula el acumulado de horas aprobadas, pendientes y restantes del estudiante en el aula
  async calcularHorasAula(aulaId) {
    const aula = await AulaVirtual.findById(aulaId);
    if (!aula) throw errorHttp('Aula virtual no encontrada', 404);

    let actividades = [];
    if (aula.modalidad === MODALIDADES.LABORAL) {
      actividades = await ActividadLaboral.find({ aulaVirtual: aulaId });
    } else {
      actividades = await ActividadComunitaria.find({ aulaVirtual: aulaId });
    }

    let horasAprobadas = 0;
    let horasPendientes = 0;
    let horasRechazadas = 0;

    for (const act of actividades) {
      if (act.estadoAprobacion === ESTADOS_ACTIVIDAD.APROBADO) {
        horasAprobadas += act.horas;
      } else if (act.estadoAprobacion === ESTADOS_ACTIVIDAD.PENDIENTE) {
        horasPendientes += act.horas;
      } else if (act.estadoAprobacion === ESTADOS_ACTIVIDAD.RECHAZADO) {
        horasRechazadas += act.horas;
      }
    }

    // Integracion de certificados externos de convalidacion (Cisco, Udemy, etc.)
    const certificados = await ConvalidacionCertificado.find({ aulaVirtual: aulaId });
    let horasConvalidadasAprobadas = 0;
    let horasConvalidadasPendientes = 0;

    for (const cert of certificados) {
      if (cert.estado === 'aprobada') {
        const acreditadas = cert.horasAcreditadas !== undefined && cert.horasAcreditadas !== null
          ? cert.horasAcreditadas
          : cert.horasCertificadas;
        horasAprobadas += acreditadas;
        horasConvalidadasAprobadas += acreditadas;
      } else if (cert.estado === 'pendiente') {
        horasPendientes += cert.horasCertificadas;
        horasConvalidadasPendientes += cert.horasCertificadas;
      } else if (cert.estado === 'rechazada') {
        horasRechazadas += cert.horasCertificadas;
      }
    }

    const porcentaje = Math.min(100, Math.round((horasAprobadas / aula.horasRequeridas) * 100));

    return {
      horasAprobadas,
      horasPendientes,
      horasRechazadas,
      horasConvalidadasAprobadas,
      horasConvalidadasPendientes,
      totalRegistradas: horasAprobadas + horasPendientes,
      horasRequeridas: aula.horasRequeridas,
      horasRestantes: Math.max(0, aula.horasRequeridas - horasAprobadas),
      porcentajeCompletado: porcentaje,
      cumplioRequisito: horasAprobadas >= aula.horasRequeridas
    };
  },

  // Registra una jornada de practica laboral con validacion estricta y prevencion de duplicados diarios
  async crearActividadLaboral(estudianteId, aulaId, datos) {
    const aula = await AulaVirtual.findById(aulaId);
    if (!aula) throw errorHttp('Aula virtual no encontrada', 404);

    if (aula.estudiante?.toString() !== estudianteId.toString()) {
      throw errorHttp('No tienes permiso para registrar actividades en esta aula virtual', 403);
    }

    if (aula.modalidad !== MODALIDADES.LABORAL) {
      throw errorHttp('Esta aula virtual no pertenece a la modalidad de Practicas Laborales', 400);
    }

    if (aula.estado !== ESTADOS_AULA.ABIERTA) {
      throw errorHttp('El aula virtual se encuentra cerrada; no se permiten nuevos registros', 400);
    }

    if (aula.expedienteEntregado) {
      throw errorHttp('El expediente ya fue entregado a revision; no se pueden anadir mas actividades', 400);
    }

    const resumenPrevio = await this.calcularHorasAula(aulaId);
    const datosValidados = validarJornadaLaboral(datos, aula, resumenPrevio);

    // Prevencion de registros duplicados en el mismo dia calendario
    const anio = datosValidados.fechaObj.getUTCFullYear();
    const mes = datosValidados.fechaObj.getUTCMonth();
    const dia = datosValidados.fechaObj.getUTCDate();
    const inicioDia = new Date(Date.UTC(anio, mes, dia, 0, 0, 0, 0));
    const finDia = new Date(Date.UTC(anio, mes, dia, 23, 59, 59, 999));

    const bitacoraExistente = await ActividadLaboral.findOne({
      aulaVirtual: aulaId,
      fecha: { $gte: inicioDia, $lte: finDia }
    });

    if (bitacoraExistente) {
      throw errorHttp(
        `Ya existe una jornada laboral registrada para la fecha ${datosValidados.fechaObj.toISOString().split('T')[0]}`,
        400
      );
    }

    const nuevaActividad = new ActividadLaboral({
      estudiante: estudianteId,
      aulaVirtual: aulaId,
      fecha: datosValidados.fechaObj,
      horaEntrada: datosValidados.horaEntrada,
      horaSalida: datosValidados.horaSalida,
      horas: datosValidados.horas,
      descripcion: datosValidados.descripcion,
      estadoAprobacion: ESTADOS_ACTIVIDAD.PENDIENTE
    });

    await nuevaActividad.save();
    const resumenActualizado = await this.calcularHorasAula(aulaId);

    return {
      success: true,
      message: 'Jornada laboral registrada exitosamente en la bitacora',
      actividad: nuevaActividad,
      resumenHoras: resumenActualizado
    };
  },

  async listarActividadesLaborales(aulaId, filtros = {}) {
    const query = { aulaVirtual: aulaId };
    if (filtros.estado && Object.values(ESTADOS_ACTIVIDAD).includes(filtros.estado)) {
      query.estadoAprobacion = filtros.estado;
    }

    const actividades = await ActividadLaboral.find(query).sort({ fecha: 1 });
    const resumen = await this.calcularHorasAula(aulaId);

    return {
      success: true,
      total: actividades.length,
      actividades,
      resumenHoras: resumen
    };
  },

  // Permite al estudiante actualizar una jornada laboral siempre que no haya sido aprobada
  async actualizarActividadLaboral(estudianteId, actividadId, datos, aulaIdOpcional = null) {
    const actividad = await ActividadLaboral.findById(actividadId);
    if (!actividad) throw errorHttp('Actividad laboral no encontrada', 404);

    if (actividad.estudiante?.toString() !== estudianteId.toString()) {
      throw errorHttp('No tienes permiso para modificar esta actividad laboral', 403);
    }

    if (aulaIdOpcional && actividad.aulaVirtual?.toString() !== aulaIdOpcional.toString()) {
      throw errorHttp('La actividad laboral no pertenece al aula virtual especificada', 400);
    }

    if (actividad.estadoAprobacion === ESTADOS_ACTIVIDAD.APROBADO) {
      throw errorHttp('No se puede modificar una actividad que ya ha sido aprobada', 400);
    }

    const aula = await AulaVirtual.findById(actividad.aulaVirtual);
    if (!aula || aula.estado !== ESTADOS_AULA.ABIERTA) {
      throw errorHttp('El aula virtual se encuentra cerrada; no se permiten modificaciones', 400);
    }

    if (aula.expedienteEntregado) {
      throw errorHttp('El expediente ya fue entregado a revision; no se pueden modificar actividades', 400);
    }

    const fechaBase = datos.fecha || (actividad.fecha instanceof Date ? actividad.fecha.toISOString().split('T')[0] : actividad.fecha);
    const datosParaValidar = {
      fecha: fechaBase,
      horaEntrada: datos.horaEntrada || actividad.horaEntrada,
      horaSalida: datos.horaSalida || actividad.horaSalida,
      horas: datos.horas !== undefined ? datos.horas : actividad.horas,
      descripcion: datos.descripcion || actividad.descripcion
    };

    const resumenPrevio = await this.calcularHorasAula(aula._id);
    const datosValidados = validarJornadaLaboral(datosParaValidar, aula, resumenPrevio);

    const anio = datosValidados.fechaObj.getUTCFullYear();
    const mes = datosValidados.fechaObj.getUTCMonth();
    const dia = datosValidados.fechaObj.getUTCDate();
    const inicioDia = new Date(Date.UTC(anio, mes, dia, 0, 0, 0, 0));
    const finDia = new Date(Date.UTC(anio, mes, dia, 23, 59, 59, 999));

    const bitacoraExistente = await ActividadLaboral.findOne({
      aulaVirtual: aula._id,
      _id: { $ne: actividadId },
      fecha: { $gte: inicioDia, $lte: finDia }
    });

    if (bitacoraExistente) {
      throw errorHttp(
        `Ya existe otra jornada laboral registrada para la fecha ${datosValidados.fechaObj.toISOString().split('T')[0]}`,
        400
      );
    }

    actividad.fecha = datosValidados.fechaObj;
    actividad.horaEntrada = datosValidados.horaEntrada;
    actividad.horaSalida = datosValidados.horaSalida;
    actividad.horas = datosValidados.horas;
    actividad.descripcion = datosValidados.descripcion;
    actividad.estadoAprobacion = ESTADOS_ACTIVIDAD.PENDIENTE;
    actividad.observacionesTutor = '';

    await actividad.save();
    const resumenActualizado = await this.calcularHorasAula(aula._id);

    return {
      success: true,
      message: 'Jornada laboral actualizada exitosamente',
      actividad,
      resumenHoras: resumenActualizado
    };
  },

  // Registra una actividad de servicio comunitario
  async crearActividadComunitaria(estudianteId, aulaId, datos) {
    const aula = await AulaVirtual.findById(aulaId);
    if (!aula) throw errorHttp('Aula virtual no encontrada', 404);

    if (aula.estudiante?.toString() !== estudianteId.toString()) {
      throw errorHttp('No tienes permiso para registrar actividades en esta aula virtual', 403);
    }

    if (aula.modalidad !== MODALIDADES.COMUNITARIO) {
      throw errorHttp('Esta aula virtual no pertenece a la modalidad de Servicio Comunitario', 400);
    }

    if (aula.estado !== ESTADOS_AULA.ABIERTA) {
      throw errorHttp('El aula virtual se encuentra cerrada; no se permiten nuevos registros', 400);
    }

    const resumenPrevio = await this.calcularHorasAula(aulaId);
    const datosValidados = validarActividadComunitariaDatos(datos, aula, resumenPrevio);

    const nuevaActividad = new ActividadComunitaria({
      estudiante: estudianteId,
      aulaVirtual: aulaId,
      fecha: datosValidados.fechaObj,
      horas: datosValidados.horas,
      comunidadOInstitucion: datosValidados.comunidadOInstitucion,
      beneficiariosAproximados: datos.beneficiariosAproximados || 0,
      descripcion: datosValidados.descripcion,
      archivoEvidenciaUrl: datos.archivoEvidenciaUrl || '',
      estadoAprobacion: ESTADOS_ACTIVIDAD.PENDIENTE
    });

    await nuevaActividad.save();
    const resumenActualizado = await this.calcularHorasAula(aulaId);

    return {
      success: true,
      message: 'Actividad comunitaria registrada exitosamente',
      actividad: nuevaActividad,
      resumenHoras: resumenActualizado
    };
  },

  async listarActividadesComunitarias(aulaId, filtros = {}) {
    const query = { aulaVirtual: aulaId };
    if (filtros.estado && Object.values(ESTADOS_ACTIVIDAD).includes(filtros.estado)) {
      query.estadoAprobacion = filtros.estado;
    }

    const actividades = await ActividadComunitaria.find(query).sort({ fecha: 1 });
    const resumen = await this.calcularHorasAula(aulaId);

    return {
      success: true,
      total: actividades.length,
      actividades,
      resumenHoras: resumen
    };
  },

  // Permite al estudiante actualizar una actividad comunitaria siempre que no haya sido aprobada
  async actualizarActividadComunitaria(estudianteId, actividadId, datos, aulaIdOpcional = null) {
    const actividad = await ActividadComunitaria.findById(actividadId);
    if (!actividad) throw errorHttp('Actividad comunitaria no encontrada', 404);

    if (actividad.estudiante?.toString() !== estudianteId.toString()) {
      throw errorHttp('No tienes permiso para modificar esta actividad comunitaria', 403);
    }

    if (aulaIdOpcional && actividad.aulaVirtual?.toString() !== aulaIdOpcional.toString()) {
      throw errorHttp('La actividad comunitaria no pertenece al aula virtual especificada', 400);
    }

    if (actividad.estadoAprobacion === ESTADOS_ACTIVIDAD.APROBADO) {
      throw errorHttp('No se puede modificar una actividad que ya ha sido aprobada', 400);
    }

    const aula = await AulaVirtual.findById(actividad.aulaVirtual);
    if (!aula || aula.estado !== ESTADOS_AULA.ABIERTA) {
      throw errorHttp('El aula virtual se encuentra cerrada; no se permiten modificaciones', 400);
    }

    if (aula.expedienteEntregado) {
      throw errorHttp('El expediente ya fue entregado a revision; no se pueden modificar actividades', 400);
    }

    const fechaBase = datos.fecha || (actividad.fecha instanceof Date ? actividad.fecha.toISOString().split('T')[0] : actividad.fecha);
    const datosParaValidar = {
      comunidadOInstitucion: datos.comunidadOInstitucion || actividad.comunidadOInstitucion,
      horas: datos.horas !== undefined ? datos.horas : actividad.horas,
      descripcion: datos.descripcion || actividad.descripcion,
      fecha: fechaBase
    };

    const resumenPrevio = await this.calcularHorasAula(aula._id);
    const datosValidados = validarActividadComunitariaDatos(datosParaValidar, aula, resumenPrevio);

    actividad.comunidadOInstitucion = datosValidados.comunidadOInstitucion;
    actividad.horas = datosValidados.horas;
    actividad.descripcion = datosValidados.descripcion;
    if (datosValidados.fechaObj) actividad.fecha = datosValidados.fechaObj;
    if (datos.beneficiariosAproximados !== undefined) actividad.beneficiariosAproximados = Number(datos.beneficiariosAproximados);
    if (datos.archivoEvidenciaUrl !== undefined) actividad.archivoEvidenciaUrl = datos.archivoEvidenciaUrl.trim();
    actividad.estadoAprobacion = ESTADOS_ACTIVIDAD.PENDIENTE;
    actividad.observacionesTutor = '';

    await actividad.save();
    const resumenActualizado = await this.calcularHorasAula(aula._id);

    return {
      success: true,
      message: 'Actividad comunitaria actualizada exitosamente',
      actividad,
      resumenHoras: resumenActualizado
    };
  },

  // Evaluacion por parte del docente tutor para aprobar o rechazar con retroalimentacion
  async evaluarActividadLaboral(actividadId, docenteId, datos) {
    const actividad = await ActividadLaboral.findById(actividadId);
    if (!actividad) throw errorHttp('Actividad laboral no encontrada', 404);

    const aula = await AulaVirtual.findById(actividad.aulaVirtual);
    if (!aula || aula.docenteTutor?.toString() !== docenteId.toString()) {
      throw errorHttp('No estas autorizado para evaluar actividades de esta aula virtual', 403);
    }

    const { estado, observacionesDocente } = datos;
    if (!estado || ![ESTADOS_ACTIVIDAD.APROBADO, ESTADOS_ACTIVIDAD.RECHAZADO].includes(estado)) {
      throw errorHttp("El estado de evaluacion debe ser 'aprobado' o 'rechazado'", 400);
    }

    actividad.estadoAprobacion = estado;
    actividad.observacionesDocente = observacionesDocente ? observacionesDocente.trim() : '';
    await actividad.save();

    const resumen = await this.calcularHorasAula(actividad.aulaVirtual);

    return {
      success: true,
      message: `Actividad laboral ${estado === ESTADOS_ACTIVIDAD.APROBADO ? 'aprobada' : 'rechazada'} exitosamente`,
      actividad,
      resumenHoras: resumen
    };
  },

  async evaluarActividadComunitaria(actividadId, docenteId, datos) {
    const actividad = await ActividadComunitaria.findById(actividadId);
    if (!actividad) throw errorHttp('Actividad comunitaria no encontrada', 404);

    const aula = await AulaVirtual.findById(actividad.aulaVirtual);
    if (!aula || aula.docenteTutor?.toString() !== docenteId.toString()) {
      throw errorHttp('No estas autorizado para evaluar actividades de esta aula virtual', 403);
    }

    const { estado, observacionesDocente } = datos;
    if (!estado || ![ESTADOS_ACTIVIDAD.APROBADO, ESTADOS_ACTIVIDAD.RECHAZADO].includes(estado)) {
      throw errorHttp("El estado de evaluacion debe ser 'aprobado' o 'rechazado'", 400);
    }

    actividad.estadoAprobacion = estado;
    actividad.observacionesDocente = observacionesDocente ? observacionesDocente.trim() : '';
    await actividad.save();

    const resumen = await this.calcularHorasAula(actividad.aulaVirtual);

    return {
      success: true,
      message: `Actividad comunitaria ${estado === ESTADOS_ACTIVIDAD.APROBADO ? 'aprobada' : 'rechazada'} exitosamente`,
      actividad,
      resumenHoras: resumen
    };
  }
};
