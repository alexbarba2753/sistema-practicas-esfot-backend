import { AulaVirtual } from '../../infrastructure/database/models/AulaVirtual.js';
import { ActividadLaboral } from '../../infrastructure/database/models/ActividadLaboral.js';
import { ActividadComunitaria } from '../../infrastructure/database/models/ActividadComunitaria.js';
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
      const registro = await ActividadLaboral.findOne({ aulaVirtual: aulaId });
      actividades = registro?.actividades || [];
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

    const porcentaje = Math.min(100, Math.round((horasAprobadas / aula.horasRequeridas) * 100));

    return {
      horasAprobadas,
      horasPendientes,
      horasRechazadas,
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
      throw errorHttp('El expediente ya fue entregado a revision; no se pueden anadir/modificar actividades', 403);
    }

    const resumenPrevio = await this.calcularHorasAula(aulaId);
    const datosValidados = validarJornadaLaboral(datos, aula, resumenPrevio);

    // Prevencion de registros duplicados en el mismo dia calendario dentro del aula
    const fechaIsoNueva = datosValidados.fechaObj.toISOString().split('T')[0];

    let registro = await ActividadLaboral.findOne({ aulaVirtual: aulaId });
    const duplicada = (registro?.actividades || []).some(
      (a) => new Date(a.fecha).toISOString().split('T')[0] === fechaIsoNueva
    );

    if (duplicada) {
      throw errorHttp(
        `Ya existe una jornada laboral registrada para la fecha ${fechaIsoNueva}`,
        400
      );
    }

    if (!registro) {
      registro = new ActividadLaboral({
        aulaVirtual: aulaId,
        estudiante: estudianteId,
        actividades: []
      });
    }

    registro.actividades.push({
      fecha: datosValidados.fechaObj,
      horaEntrada: datosValidados.horaEntrada,
      horaSalida: datosValidados.horaSalida,
      horas: datosValidados.horas,
      descripcion: datosValidados.descripcion,
      estadoAprobacion: ESTADOS_ACTIVIDAD.PENDIENTE,
      observacionesDocente: ''
    });

    await registro.save();
    const nuevaActividad = registro.actividades[registro.actividades.length - 1];
    const resumenActualizado = await this.calcularHorasAula(aulaId);

    return {
      success: true,
      message: 'Jornada laboral registrada exitosamente en la bitacora',
      actividad: nuevaActividad,
      resumenHoras: resumenActualizado
    };
  },

  async listarActividadesLaborales(aulaId, filtros = {}) {
    const registro = await ActividadLaboral.findOne({ aulaVirtual: aulaId });
    let actividades = [...(registro?.actividades || [])];

    if (filtros.estado && Object.values(ESTADOS_ACTIVIDAD).includes(filtros.estado)) {
      actividades = actividades.filter((a) => a.estadoAprobacion === filtros.estado);
    }

    actividades.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
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
    const registro = await ActividadLaboral.findOne({ 'actividades._id': actividadId });
    if (!registro) throw errorHttp('Actividad laboral no encontrada', 404);

    const actividad = typeof registro.actividades?.id === 'function'
      ? registro.actividades.id(actividadId)
      : (registro.actividades || []).find((a) => a._id?.toString() === actividadId.toString());
    if (!actividad) throw errorHttp('Actividad laboral no encontrada', 404);

    if (registro.estudiante?.toString() !== estudianteId.toString()) {
      throw errorHttp('No tienes permiso para modificar esta actividad laboral', 403);
    }

    if (aulaIdOpcional && registro.aulaVirtual?.toString() !== aulaIdOpcional.toString()) {
      throw errorHttp('La actividad laboral no pertenece al aula virtual especificada', 400);
    }

    if (actividad.estadoAprobacion === ESTADOS_ACTIVIDAD.APROBADO) {
      throw errorHttp('No se puede modificar una actividad que ya ha sido aprobada', 400);
    }

    const aula = await AulaVirtual.findById(registro.aulaVirtual);
    if (!aula || aula.estado !== ESTADOS_AULA.ABIERTA) {
      throw errorHttp('El aula virtual se encuentra cerrada; no se permiten modificaciones', 400);
    }

    if (aula.expedienteEntregado) {
      throw errorHttp('El expediente ya fue entregado a revision; no se pueden anadir/modificar actividades', 403);
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

    const fechaIsoEditada = datosValidados.fechaObj.toISOString().split('T')[0];
    const duplicada = registro.actividades.some(
      (a) =>
        a._id?.toString() !== actividadId.toString() &&
        new Date(a.fecha).toISOString().split('T')[0] === fechaIsoEditada
    );

    if (duplicada) {
      throw errorHttp(
        `Ya existe otra jornada laboral registrada para la fecha ${fechaIsoEditada}`,
        400
      );
    }

    actividad.fecha = datosValidados.fechaObj;
    actividad.horaEntrada = datosValidados.horaEntrada;
    actividad.horaSalida = datosValidados.horaSalida;
    actividad.horas = datosValidados.horas;
    actividad.descripcion = datosValidados.descripcion;
    actividad.estadoAprobacion = ESTADOS_ACTIVIDAD.PENDIENTE;
    actividad.observacionesDocente = '';

    await registro.save();
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

    if (aula.expedienteEntregado) {
      throw errorHttp('El expediente ya fue entregado a revision; no se pueden anadir mas actividades', 403);
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
      throw errorHttp('El expediente ya fue entregado a revision; no se pueden anadir/modificar actividades', 403);
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
    const registro = await ActividadLaboral.findOne({ 'actividades._id': actividadId });
    if (!registro) throw errorHttp('Actividad laboral no encontrada', 404);

    const actividad = typeof registro.actividades?.id === 'function'
      ? registro.actividades.id(actividadId)
      : (registro.actividades || []).find((a) => a._id?.toString() === actividadId.toString());
    if (!actividad) throw errorHttp('Actividad laboral no encontrada', 404);

    const aula = await AulaVirtual.findById(registro.aulaVirtual);
    if (!aula || aula.docenteTutor?.toString() !== docenteId.toString()) {
      throw errorHttp('No estas autorizado para evaluar actividades de esta aula virtual', 403);
    }

    const { estado, observacionesDocente } = datos;
    if (!estado || ![ESTADOS_ACTIVIDAD.APROBADO, ESTADOS_ACTIVIDAD.RECHAZADO].includes(estado)) {
      throw errorHttp("El estado de evaluacion debe ser 'aprobado' o 'rechazado'", 400);
    }

    actividad.estadoAprobacion = estado;
    actividad.observacionesDocente = observacionesDocente ? observacionesDocente.trim() : '';
    await registro.save();

    const resumen = await this.calcularHorasAula(registro.aulaVirtual);

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
