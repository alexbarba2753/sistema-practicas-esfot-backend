import { AulaVirtual } from '../../infrastructure/database/models/AulaVirtual.js';
import { AulaConvalidacion } from '../../infrastructure/database/models/AulaConvalidacion.js';
import { FormularioPendiente } from '../../infrastructure/database/models/FormularioPendiente.js';
import { FormularioAprobacion } from '../../infrastructure/database/models/FormularioAprobacion.js';
import { ActividadLaboral } from '../../infrastructure/database/models/ActividadLaboral.js';
import { ESTADOS_AULA, MODALIDADES } from '../../domain/constants/practicasConstants.js';
import { actividadService } from './actividadService.js';
import { excelService } from './excelService.js';
import { errorHttp } from '../../domain/utils/errorHttp.js';
import { validarYCalcularHorarioSemanal } from '../../domain/utils/validarHorario.js';

const CAMPOS_ENTIDAD_LABORAL = [
  'razonSocial',
  'ruc',
  'direccion',
  'correo',
  'ciudad',
  'telefono',
  'celular',
  'tipoEntidad',
  'responsable',
  'areaAsignada',
  'cedulaResponsable'
];

const CAMPOS_ENTIDAD_CONVALIDACION = [
  'razonSocial',
  'ruc',
  'direccion',
  'correo',
  'ciudad',
  'telefono',
  'celular',
  'tipoEntidad',
  'responsable',
  'areaAsignada',
  'campoAmplio',
  'campoEspecifico',
  'codigoProyecto',
  'nombreProyecto'
];

const CAMPOS_IA_LABORAL = [
  'asignaturasUtilidad',
  'principalesActividades',
  'habilidadesAdquiridas',
  'observacionesTemas'
];

const CAMPOS_IA_CONVALIDACION = [
  'resumenActividades',
  'contribucionConocimientos',
  'resultadosAprendizaje',
  'asignaturasMalla'
];

function aplicarCamposPorTipoAula(formulario, esConvalidacion, datos) {
  if (esConvalidacion && datos.documentacionSoporte !== undefined) {
    formulario.documentacionSoporte = String(datos.documentacionSoporte).trim();
  }

  if (datos.entidadReceptora) {
    const actual = typeof formulario.entidadReceptora?.toObject === 'function'
      ? formulario.entidadReceptora.toObject()
      : (formulario.entidadReceptora || {});
    const permitidos = esConvalidacion ? CAMPOS_ENTIDAD_CONVALIDACION : CAMPOS_ENTIDAD_LABORAL;
    const filtrado = {};
    for (const campo of permitidos) {
      if (datos.entidadReceptora[campo] !== undefined) {
        filtrado[campo] = datos.entidadReceptora[campo];
      }
    }
    formulario.entidadReceptora = { ...actual, ...filtrado };
  }

  if (!esConvalidacion) {
    const creditos = datos.creditosAprobados ?? datos.datosPracticante?.creditosAprobados;
    if (creditos !== undefined) {
      formulario.creditosAprobados = Number(creditos);
    }

    const totalH = datos.totalHoras ?? datos.horarioSemanal?.totalHoras;
    if (totalH !== undefined) {
      const nTotal = Number(totalH);
      if (isNaN(nTotal) || nTotal <= 0) {
        throw errorHttp('El numero total de horas debe ser mayor a cero', 400);
      }
      formulario.totalHoras = nTotal;
    }

    if (datos.horarioSemanal?.observacionesFechas !== undefined) {
      const actualHorario = typeof formulario.horarioSemanal?.toObject === 'function'
        ? formulario.horarioSemanal.toObject()
        : (formulario.horarioSemanal || {});
      formulario.horarioSemanal = {
        ...actualHorario,
        observacionesFechas: String(datos.horarioSemanal.observacionesFechas).trim()
      };
    }

    if (datos.evaluacionCualitativa) {
      const permitidosEval = ['Excelente', 'Muy Buena', 'Satisfactoria', 'Deficiente'];
      const actualEval = typeof formulario.evaluacionCualitativa?.toObject === 'function'
        ? formulario.evaluacionCualitativa.toObject()
        : (formulario.evaluacionCualitativa || {});
      const nuevoEval = { ...actualEval };
      for (const k of ['asistenciaPuntualidad', 'desempeno', 'motivacion', 'conocimientosDestrezas']) {
        if (datos.evaluacionCualitativa[k] !== undefined) {
          if (!permitidosEval.includes(datos.evaluacionCualitativa[k])) {
            throw errorHttp(`Valor invalido para evaluacionCualitativa.${k}. Use: ${permitidosEval.join(', ')}`, 400);
          }
          nuevoEval[k] = datos.evaluacionCualitativa[k];
        }
      }
      formulario.evaluacionCualitativa = nuevoEval;
    }
  }

  if (datos.contenidoIa) {
    const actualIa = typeof formulario.contenidoIa?.toObject === 'function'
      ? formulario.contenidoIa.toObject()
      : (formulario.contenidoIa || {});
    const permitidosIa = esConvalidacion ? CAMPOS_IA_CONVALIDACION : CAMPOS_IA_LABORAL;
    const iaFiltrado = {};
    for (const campo of permitidosIa) {
      if (datos.contenidoIa[campo] !== undefined) {
        iaFiltrado[campo] = datos.contenidoIa[campo];
      }
    }
    formulario.contenidoIa = { ...actualIa, ...iaFiltrado };
  }
}

async function buscarAulaPorId(aulaId, { populateEstudiante = false, populateDocente = false } = {}) {
  const aplicarPopulate = (query) => {
    let q = query;
    if (populateEstudiante && typeof q?.populate === 'function') {
      q = q.populate('estudiante', 'nombres apellidos cedula correo telefono');
    }
    if (populateDocente && typeof q?.populate === 'function') {
      q = q.populate('docenteTutor', 'nombres apellidos cedula correo telefono');
    }
    return q;
  };

  const aulaLab = await aplicarPopulate(AulaVirtual.findById(aulaId));
  if (aulaLab) return { aula: aulaLab, esConvalidacion: false };

  const aulaConv = await aplicarPopulate(AulaConvalidacion.findById(aulaId));
  if (aulaConv) return { aula: aulaConv, esConvalidacion: true };

  return { aula: null, esConvalidacion: false };
}

async function buscarAulaDocente(aulaId, docenteId, { populate = false } = {}) {
  const aplicarPopulate = (query) => {
    if (populate && typeof query?.populate === 'function') {
      return query
        .populate('docenteTutor', 'nombres apellidos correo telefono')
        .populate('estudiante', 'nombres apellidos correo cedula telefono estado');
    }
    return query;
  };

  const aulaLab = await aplicarPopulate(AulaVirtual.findOne({ _id: aulaId, docenteTutor: docenteId }));
  if (aulaLab) return { aula: aulaLab, esConvalidacion: false };

  const aulaConv = await aplicarPopulate(AulaConvalidacion.findOne({ _id: aulaId, docenteTutor: docenteId }));
  if (aulaConv) return { aula: aulaConv, esConvalidacion: true };

  return { aula: null, esConvalidacion: false };
}

function formatearDatosGeneralesFormulario(formulario, aula, esConvalidacionOpcional = null) {
  const er = typeof formulario.entidadReceptora?.toObject === 'function'
    ? formulario.entidadReceptora.toObject()
    : (formulario.entidadReceptora || {});
  const hs = typeof formulario.horarioSemanal?.toObject === 'function'
    ? formulario.horarioSemanal.toObject()
    : (formulario.horarioSemanal || {});
  const ci = typeof formulario.contenidoIa?.toObject === 'function'
    ? formulario.contenidoIa.toObject()
    : (formulario.contenidoIa || {});
  const est =
    formulario.estudiante && typeof formulario.estudiante === 'object' && formulario.estudiante.nombres
      ? formulario.estudiante
      : aula?.estudiante && typeof aula.estudiante === 'object'
      ? aula.estudiante
      : {};
  const emp = aula?.datosEmpresa || aula?.datosInstitucion || {};
  const esConvalidacion = esConvalidacionOpcional !== null
    ? esConvalidacionOpcional
    : formulario.tipoAula === 'convalidacion';

  const base = {
    _id: formulario._id,
    aulaVirtual: formulario.aulaVirtual?._id || formulario.aulaVirtual,
    modalidad: formulario.modalidad,
    tipoAula: esConvalidacion ? 'convalidacion' : 'laboral',
    estado: formulario.estado,
    entidadReceptora: {
      razonSocial: er.razonSocial || emp.razonSocial || '',
      ruc: er.ruc || emp.ruc || '',
      direccion: er.direccion || emp.direccion || '',
      correo: er.correo || emp.correo || '',
      ciudad: er.ciudad || emp.ciudad || 'Quito',
      telefono: er.telefono || emp.telefono || '',
      celular: er.celular || emp.celular || '',
      tipoEntidad: er.tipoEntidad || emp.tipoInstitucion || 'Privada',
      responsable: er.responsable || emp.responsable || '',
      areaAsignada: er.areaAsignada || emp.areaAsignada || '',
      cedulaResponsable: er.cedulaResponsable || emp.cedulaResponsable || '',
      ...(esConvalidacion
        ? {
            campoAmplio: er.campoAmplio || emp.campoAmplio || '',
            campoEspecifico: er.campoEspecifico || emp.campoEspecifico || '',
            codigoProyecto: er.codigoProyecto || emp.codigoProyecto || '',
            nombreProyecto: er.nombreProyecto || emp.nombreProyecto || ''
          }
        : {})
    },
    datosPracticante: {
      nombres: est.nombres || '',
      apellidos: est.apellidos || '',
      nombreCompleto: `${est.nombres || ''} ${est.apellidos || ''}`.trim(),
      cedula: est.cedula || '',
      creditosAprobados: formulario.creditosAprobados || 0
    },
    horarioSemanal: {
      fechaInicio: aula?.fechaInicio || null,
      fechaFin: aula?.fechaFin || null,
      configurado: Boolean(hs && Number(hs.horasSemanales) > 0),
      lunes: hs.lunes || [],
      martes: hs.martes || [],
      miercoles: hs.miercoles || [],
      jueves: hs.jueves || [],
      viernes: hs.viernes || [],
      sabado: hs.sabado || [],
      domingo: hs.domingo || [],
      horasSemanales: hs.horasSemanales || 0,
      horasProyectadas: hs.horasProyectadas || 0,
      observacionesFechas: hs.observacionesFechas || '',
      totalHoras: formulario.totalHoras || hs.horasProyectadas || 0
    },
    contenidoIa: esConvalidacion
      ? {
          resumenActividades: ci.resumenActividades || '',
          contribucionConocimientos: ci.contribucionConocimientos || '',
          resultadosAprendizaje: ci.resultadosAprendizaje || '',
          asignaturasMalla: ci.asignaturasMalla || ''
        }
      : {
          asignaturasUtilidad: ci.asignaturasUtilidad || '',
          principalesActividades: ci.principalesActividades || '',
          habilidadesAdquiridas: ci.habilidadesAdquiridas || '',
          observacionesTemas: ci.observacionesTemas || ''
        },
    ultimaEdicionEstudiante: formulario.ultimaEdicionEstudiante || null
  };

  if (!esConvalidacion) {
    const ec = formulario.evaluacionCualitativa || {};
    base.evaluacionCualitativa = {
      asistenciaPuntualidad: ec.asistenciaPuntualidad || '',
      desempeno: ec.desempeno || '',
      motivacion: ec.motivacion || '',
      conocimientosDestrezas: ec.conocimientosDestrezas || ''
    };
  }

  if (esConvalidacion) {
    base.carrera = aula?.carrera || 'Desarrollo de Software';
    base.documentacionSoporte = formulario.documentacionSoporte || '';
    base.seccion1y2Marcas = formulario.seccion1y2Marcas || aula?.seccion1y2Marcas || [];
    base.seguimientoTutor = formulario.seguimientoTutor || null;
    base.resolucionComision = formulario.resolucionComision || null;
  }

  return base;
}

async function actualizarFechasAulaSiCorresponde(aula, aulaId, esConvalidacion, datos) {
  const nuevaFechaInicioRaw = datos.horarioSemanal?.fechaInicio ?? datos.fechaInicio;
  const nuevaFechaFinRaw = datos.horarioSemanal?.fechaFin ?? datos.fechaFin;
  if (nuevaFechaInicioRaw === undefined && nuevaFechaFinRaw === undefined) return;

  const fInicio = nuevaFechaInicioRaw !== undefined ? new Date(nuevaFechaInicioRaw) : new Date(aula.fechaInicio);
  const fFin = nuevaFechaFinRaw !== undefined ? new Date(nuevaFechaFinRaw) : new Date(aula.fechaFin);

  if (isNaN(fInicio.getTime()) || isNaN(fFin.getTime())) {
    throw errorHttp('Las fechas de inicio y fin del aula deben tener un formato valido (YYYY-MM-DD)', 400);
  }

  if (fFin <= fInicio) {
    throw errorHttp('La fecha de fin del aula debe ser posterior a la fecha de inicio', 400);
  }

  if (!esConvalidacion) {
    const regLab = await ActividadLaboral.findOne({ aulaVirtual: aulaId });
    const acts = regLab?.actividades || [];
    if (acts.length > 0) {
      const fechasIso = acts.map((a) => new Date(a.fecha).toISOString().split('T')[0]).sort();
      const minFecha = fechasIso[0];
      const maxFecha = fechasIso[fechasIso.length - 1];
      const nuevoInicioStr = fInicio.toISOString().split('T')[0];
      const nuevoFinStr = fFin.toISOString().split('T')[0];

      if (nuevoInicioStr > minFecha) {
        throw errorHttp(
          `La fecha de inicio (${nuevoInicioStr}) no puede ser posterior a la actividad ya registrada el ${minFecha}`,
          400
        );
      }
      if (nuevoFinStr < maxFecha) {
        throw errorHttp(
          `La fecha de fin (${nuevoFinStr}) no puede ser anterior a la actividad ya registrada el ${maxFecha}`,
          400
        );
      }
    }
  }

  aula.fechaInicio = fInicio;
  aula.fechaFin = fFin;
  await aula.save();
}

export const expedienteService = {
  // Consulta las aulas virtuales en las que participa el estudiante con resumen de progreso
  async obtenerAulasEstudiante(estudianteId) {
    const aulas = await AulaVirtual.find({ estudiante: estudianteId })
      .populate('docenteTutor', 'nombres apellidos correo telefono')
      .populate('estudiante', 'nombres apellidos correo cedula telefono estado')
      .sort({ createdAt: -1 });

    const aulasConProgreso = await Promise.all(
      aulas.map(async (aula) => {
        const resumen = await actividadService.calcularHorasAula(aula._id);
        return {
          _id: aula._id,
          nombre: aula.nombre,
          periodo: aula.periodo,
          modalidad: aula.modalidad,
          tipoAula: 'laboral',
          horasRequeridas: aula.horasRequeridas,
          fechaInicio: aula.fechaInicio,
          fechaFin: aula.fechaFin,
          estado: aula.estado,
          expedienteEntregado: aula.expedienteEntregado,
          docenteTutor: aula.docenteTutor,
          resumenHoras: resumen
        };
      })
    );

    const aulasConv = await AulaConvalidacion.find({ estudiante: estudianteId })
      .populate('docenteTutor', 'nombres apellidos correo telefono')
      .populate('estudiante', 'nombres apellidos correo cedula telefono estado')
      .sort({ createdAt: -1 });

    const aulasConvFormateadas = aulasConv.map((aula) => ({
      _id: aula._id,
      nombre: aula.nombre,
      periodo: aula.periodo,
      modalidad: aula.modalidad,
      tipoAula: 'convalidacion',
      carrera: aula.carrera,
      horasRequeridas: aula.horasRequeridas,
      fechaInicio: aula.fechaInicio,
      fechaFin: aula.fechaFin,
      estado: aula.estado,
      expedienteEntregado: aula.expedienteEntregado,
      docenteTutor: aula.docenteTutor,
      certificadoPdf: aula.certificadoPdf?.nombreArchivo || '',
      datosInstitucion: aula.datosInstitucion || {},
      resumenHoras: {
        horasAprobadas: aula.horasRequeridas,
        horasPendientes: 0,
        horasRequeridas: aula.horasRequeridas,
        porcentajeCompletado: 100,
        cumplioRequisito: true
      }
    }));

    const todas = [...aulasConProgreso, ...aulasConvFormateadas];

    return {
      success: true,
      total: todas.length,
      aulas: todas
    };
  },

  async obtenerFormularioPendiente(aulaId) {
    const { aula, esConvalidacion } = await buscarAulaPorId(aulaId, { populateEstudiante: true });
    if (!aula) throw errorHttp('Aula virtual no encontrada', 404);

    let formulario = await FormularioPendiente.findOne({ aulaVirtual: aulaId });
    if (!formulario) {
      formulario = await FormularioAprobacion.findOne({ aulaVirtual: aulaId });
    }
    if (!formulario) {
      const emp = aula.datosEmpresa || {};
      formulario = new FormularioPendiente({
        aulaVirtual: aulaId,
        estudiante: aula.estudiante?._id || aula.estudiante,
        modalidad: aula.modalidad,
        tipoAula: esConvalidacion ? 'convalidacion' : 'laboral',
        totalHoras: esConvalidacion ? aula.horasRequeridas : 0,
        entidadReceptora: {
          razonSocial: emp.razonSocial || '',
          areaAsignada: emp.areaAsignada || '',
          responsable: emp.responsable || ''
        },
        horarioSemanal: {
          horaInicio: '08:00',
          horaFin: '16:30',
          horasSemanales: emp.horasDiarias ? emp.horasDiarias * 5 : 40
        }
      });
      await formulario.save();
    }
    return formatearDatosGeneralesFormulario(formulario, aula, esConvalidacion);
  },

  async configurarHorarioLaboral(aulaId, estudianteId, datos) {
    const queryAula = AulaVirtual.findById(aulaId);
    const aula = typeof queryAula?.populate === 'function'
      ? await queryAula.populate('estudiante', 'nombres apellidos cedula correo')
      : await queryAula;
    if (!aula) throw errorHttp('Aula virtual laboral no encontrada', 404);

    const aulaEstudianteId = aula.estudiante?._id ? aula.estudiante._id.toString() : aula.estudiante?.toString();
    if (aulaEstudianteId !== estudianteId.toString()) {
      throw errorHttp('No tienes permiso para configurar el horario de esta aula', 403);
    }

    if (aula.estado !== ESTADOS_AULA.ABIERTA) {
      throw errorHttp('El aula virtual se encuentra cerrada; no se puede modificar el horario', 400);
    }

    let formulario = await FormularioPendiente.findOne({ aulaVirtual: aulaId });
    if (aula.expedienteEntregado && formulario?.estado !== 'observado') {
      throw errorHttp('El expediente ya fue entregado a revision; no se puede modificar el horario', 403);
    }

    const { horarioNormalizado, horasSemanales, horasProyectadas } = validarYCalcularHorarioSemanal(datos, aula);

    if (!formulario) {
      const emp = aula.datosEmpresa || {};
      formulario = new FormularioPendiente({
        aulaVirtual: aulaId,
        estudiante: estudianteId,
        modalidad: aula.modalidad,
        tipoAula: 'laboral',
        entidadReceptora: {
          razonSocial: emp.razonSocial || '',
          areaAsignada: emp.areaAsignada || '',
          responsable: emp.responsable || '',
          cedulaResponsable: emp.cedulaResponsable || ''
        }
      });
    }

    const obsPrevias = formulario.horarioSemanal?.observacionesFechas || '';
    formulario.horarioSemanal = {
      ...horarioNormalizado,
      horasSemanales,
      horasProyectadas,
      observacionesFechas: datos.observacionesFechas !== undefined
        ? String(datos.observacionesFechas).trim()
        : obsPrevias
    };
    formulario.totalHoras = datos.totalHoras !== undefined ? Number(datos.totalHoras) : horasProyectadas;
    formulario.ultimaEdicionEstudiante = new Date();

    await formulario.save();
    return formatearDatosGeneralesFormulario(formulario, aula, false);
  },

  async actualizarFormularioPendiente(aulaId, estudianteId, datos) {
    const { aula, esConvalidacion } = await buscarAulaPorId(aulaId, { populateEstudiante: true });
    if (!aula) throw errorHttp('Aula virtual no encontrada', 404);

    const aulaEstudianteId = aula.estudiante?._id ? aula.estudiante._id.toString() : aula.estudiante?.toString();
    if (aulaEstudianteId !== estudianteId.toString()) {
      throw errorHttp('No tienes permiso para modificar este formulario', 403);
    }

    let formulario = await FormularioPendiente.findOne({ aulaVirtual: aulaId });
    if (!formulario) {
      formulario = new FormularioPendiente({
        aulaVirtual: aulaId,
        estudiante: estudianteId,
        modalidad: aula.modalidad,
        tipoAula: esConvalidacion ? 'convalidacion' : 'laboral'
      });
    }

    if (aula.expedienteEntregado && formulario.estado !== 'observado') {
      throw errorHttp('El expediente ya fue entregado a revision; no se puede modificar el formulario', 403);
    }

    await actualizarFechasAulaSiCorresponde(aula, aulaId, esConvalidacion, datos);
    aplicarCamposPorTipoAula(formulario, esConvalidacion, datos);

    formulario.ultimaEdicionEstudiante = new Date();
    await formulario.save();

    return formatearDatosGeneralesFormulario(formulario, aula, esConvalidacion);
  },

  async actualizarFormularioPendienteDocente(aulaId, docenteId, datos) {
    const { aula, esConvalidacion } = await buscarAulaDocente(aulaId, docenteId, { populate: true });
    if (!aula) throw errorHttp('Aula virtual no encontrada o no asignada a este docente tutor', 404);

    if (aula.estado === ESTADOS_AULA.CERRADA) {
      throw errorHttp('El aula virtual ya se encuentra cerrada; no se puede modificar el formulario', 403);
    }

    let formulario = await FormularioPendiente.findOne({ aulaVirtual: aulaId });
    if (!formulario) {
      throw errorHttp('No se encontro el formulario pendiente del aula', 404);
    }

    await actualizarFechasAulaSiCorresponde(aula, aulaId, esConvalidacion, datos);
    aplicarCamposPorTipoAula(formulario, esConvalidacion, datos);

    await formulario.save();
    return formatearDatosGeneralesFormulario(formulario, aula, esConvalidacion);
  },

  // Entrega formal del expediente completo de practicas o convalidacion al docente tutor
  async entregarExpediente(aulaId, estudianteId) {
    const { aula, esConvalidacion } = await buscarAulaPorId(aulaId);
    if (!aula) throw errorHttp('Aula virtual no encontrada', 404);

    if (aula.estudiante?.toString() !== estudianteId.toString()) {
      throw errorHttp('No tienes permiso para entregar este expediente', 403);
    }

    if (aula.expedienteEntregado) {
      throw errorHttp('El expediente ya fue entregado previamente para revision', 400);
    }

    if (esConvalidacion) {
      const formPendiente = await FormularioPendiente.findOne({ aulaVirtual: aulaId });
      if (!formPendiente) {
        throw errorHttp('No se encontro el formulario FCP-001A pendiente para esta convalidacion', 400);
      }
    } else {
      const resumen = await actividadService.calcularHorasAula(aulaId);
      if (!resumen.cumplioRequisito) {
        throw errorHttp(
          `No se puede entregar el expediente: Se requieren ${aula.horasRequeridas}h y actualmente tienes ${resumen.horasAprobadas}h aprobadas`,
          400
        );
      }
    }

    aula.expedienteEntregado = true;
    aula.fechaEntregaExpediente = new Date();
    await aula.save();

    let formulario = await FormularioPendiente.findOne({ aulaVirtual: aulaId });
    if (formulario) {
      formulario.estado = 'en_revision';
      await formulario.save();
    }

    return {
      success: true,
      message: 'Expediente entregado formalmente al docente tutor para su aprobacion',
      fechaEntrega: aula.fechaEntregaExpediente
    };
  },

  // Consulta las aulas virtuales asignadas al docente tutor con progreso de horas de cada estudiante
  async obtenerAulasDocente(docenteId) {
    const aulas = await AulaVirtual.find({ docenteTutor: docenteId })
      .populate('docenteTutor', 'nombres apellidos correo telefono')
      .populate('estudiante', 'nombres apellidos correo cedula telefono estado')
      .sort({ createdAt: -1 });

    const aulasConProgreso = await Promise.all(
      aulas.map(async (aula) => {
        const resumen = await actividadService.calcularHorasAula(aula._id);
        return {
          _id: aula._id,
          nombre: aula.nombre,
          periodo: aula.periodo,
          modalidad: aula.modalidad,
          tipoAula: 'laboral',
          horasRequeridas: aula.horasRequeridas,
          fechaInicio: aula.fechaInicio,
          fechaFin: aula.fechaFin,
          estado: aula.estado,
          expedienteEntregado: aula.expedienteEntregado,
          estudiante: aula.estudiante,
          resumenHoras: resumen
        };
      })
    );

    const aulasConv = await AulaConvalidacion.find({ docenteTutor: docenteId })
      .populate('docenteTutor', 'nombres apellidos correo telefono')
      .populate('estudiante', 'nombres apellidos correo cedula telefono estado')
      .sort({ createdAt: -1 });

    const aulasConvFormateadas = aulasConv.map((aula) => ({
      _id: aula._id,
      nombre: aula.nombre,
      periodo: aula.periodo,
      modalidad: aula.modalidad,
      tipoAula: 'convalidacion',
      carrera: aula.carrera,
      horasRequeridas: aula.horasRequeridas,
      fechaInicio: aula.fechaInicio,
      fechaFin: aula.fechaFin,
      estado: aula.estado,
      expedienteEntregado: aula.expedienteEntregado,
      estudiante: aula.estudiante,
      certificadoPdf: aula.certificadoPdf?.nombreArchivo || '',
      datosInstitucion: aula.datosInstitucion || {},
      resumenHoras: {
        horasAprobadas: aula.horasRequeridas,
        horasPendientes: 0,
        horasRequeridas: aula.horasRequeridas,
        porcentajeCompletado: 100,
        cumplioRequisito: true
      }
    }));

    const todas = [...aulasConProgreso, ...aulasConvFormateadas];

    return {
      success: true,
      total: todas.length,
      aulas: todas
    };
  },

  async obtenerDetalleAulaDocente(aulaId, docenteId) {
    const { aula, esConvalidacion } = await buscarAulaDocente(aulaId, docenteId, { populate: true });
    if (!aula) throw errorHttp('Aula virtual no encontrada o no asignada a este docente tutor', 404);

    const formulario = await FormularioPendiente.findOne({ aulaVirtual: aulaId });
    const actaAprobacion = await FormularioAprobacion.findOne({ aulaVirtual: aulaId });

    let resumen;
    let horasConvalidadas = 0;
    if (esConvalidacion) {
      resumen = {
        horasAprobadas: aula.horasRequeridas,
        horasPendientes: 0,
        horasRequeridas: aula.horasRequeridas,
        porcentajeCompletado: 100,
        cumplioRequisito: true
      };
      horasConvalidadas = aula.horasRequeridas;
    } else {
      resumen = await actividadService.calcularHorasAula(aulaId);
    }

    return {
      success: true,
      aula: {
        _id: aula._id,
        nombre: aula.nombre,
        periodo: aula.periodo,
        modalidad: aula.modalidad,
        tipoAula: esConvalidacion ? 'convalidacion' : 'laboral',
        carrera: aula.carrera,
        horasRequeridas: aula.horasRequeridas,
        fechaInicio: aula.fechaInicio,
        fechaFin: aula.fechaFin,
        estado: aula.estado,
        expedienteEntregado: aula.expedienteEntregado,
        fechaEntregaExpediente: aula.fechaEntregaExpediente,
        estudiante: aula.estudiante,
        docenteTutor: aula.docenteTutor,
        certificadoPdf: esConvalidacion ? aula.certificadoPdf : undefined,
        datosInstitucion: esConvalidacion ? aula.datosInstitucion : undefined,
        resumenHoras: resumen,
        horasConvalidadas,
        formularioPendiente: formulario,
        actaAprobacion
      }
    };
  },

  // Dictamen del docente tutor: aprobar (pasa a revision final del admin) o devolver con observaciones al estudiante
  async cerrarProcesoDocente(aulaId, docenteId, datos = {}) {
    const { aula, esConvalidacion } = await buscarAulaDocente(aulaId, docenteId);
    if (!aula) throw errorHttp('Aula virtual no encontrada o no asignada a este docente tutor', 404);

    if (aula.estado === ESTADOS_AULA.CERRADA) {
      throw errorHttp('Esta aula virtual ya fue cerrada formalmente con anterioridad', 400);
    }

    if (!aula.expedienteEntregado) {
      throw errorHttp('El estudiante aun no ha entregado formalmente el expediente para revision', 400);
    }

    if (!esConvalidacion) {
      const resumen = await actividadService.calcularHorasAula(aulaId);
      if (resumen.horasAprobadas < aula.horasRequeridas) {
        throw errorHttp(
          `El estudiante aun no cumple con las horas reglamentarias (${resumen.horasAprobadas}/${aula.horasRequeridas} horas aprobadas)`,
          400
        );
      }
    }

    const dictamen = datos.dictamen === 'No Aprobado' ? 'No Aprobado' : 'Aprobado';
    const observaciones = (datos.observaciones ?? datos.observacionesFinales ?? '').trim();

    let formulario = await FormularioPendiente.findOne({ aulaVirtual: aulaId });
    if (!formulario) {
      throw errorHttp('No se encontro el formulario pendiente del aula', 404);
    }

    if (dictamen === 'No Aprobado') {
      if (!observaciones) {
        throw errorHttp('Debe ingresar las observaciones al devolver o rechazar la practica', 400);
      }

      aula.expedienteEntregado = false;
      await aula.save();

      formulario.estado = 'observado';
      formulario.seguimientoTutor.observacionesMejora = observaciones;
      await formulario.save();

      return {
        success: true,
        message: 'Expediente devuelto al estudiante con observaciones del docente tutor.',
        dictamen,
        observaciones,
        formularioEstado: formulario.estado,
        aulaEstado: aula.estado
      };
    }

    if (esConvalidacion && !formulario.seguimientoTutor?.completadoPorTutor) {
      throw errorHttp(
        'Debe completar primero la Seccion 9 (evaluar-formulario) antes de aprobar el expediente de convalidacion',
        400
      );
    }

    // Aprobado por el docente: permanece en formularios_pendientes hasta el veredicto final del administrador
    formulario.estado = 'aprobado_docente';
    formulario.seguimientoTutor.fechaRevisionTutor = new Date();
    if (observaciones) {
      formulario.seguimientoTutor.observacionesMejora = observaciones;
    }
    await formulario.save();

    return {
      success: true,
      message: 'Formulario aprobado por el docente tutor y remitido para aprobación final del administrador.',
      dictamen: 'Aprobado',
      observaciones: observaciones || formulario.seguimientoTutor?.observacionesMejora || '',
      formularioEstado: formulario.estado,
      aulaEstado: aula.estado
    };
  },

  // Evaluacion de seguimiento del tutor academico (Punto 6 del F_AA_119 / Punto 9 del FCP_001A)
  async evaluarSeguimientoDocente(aulaId, docenteId, datos = {}) {
    const { aula, esConvalidacion } = await buscarAulaDocente(aulaId, docenteId);
    if (!aula) throw errorHttp('Aula virtual no encontrada o no asignada a este docente tutor', 404);

    let formulario = await FormularioPendiente.findOne({ aulaVirtual: aulaId });
    if (!formulario) throw errorHttp('No se encontro el formulario pendiente del aula', 404);

    // Si el tutor encuentra errores y devuelve al estudiante
    if (datos.estado === 'observado' || datos.devolverAEstudiante === true) {
      formulario.estado = 'observado';
      formulario.seguimientoTutor.observacionesMejora = datos.observaciones || 'Se requieren correcciones en el informe';
      aula.expedienteEntregado = false;
      await aula.save();
      await formulario.save();

      return {
        success: true,
        message: 'Expediente devuelto al estudiante para correcciones con observaciones del tutor',
        formulario
      };
    }

    if (esConvalidacion || formulario.tipoAula === 'convalidacion') {
      const q1 = datos.contribuyoConocimientos !== undefined
        ? Boolean(datos.contribuyoConocimientos)
        : (datos.recomiendaEntidad !== undefined ? Boolean(datos.recomiendaEntidad) : true);
      const q2 = datos.contribuyoResultadosAprendizaje !== undefined
        ? Boolean(datos.contribuyoResultadosAprendizaje)
        : (datos.aportaPerfilEgreso !== undefined ? Boolean(datos.aportaPerfilEgreso) : true);
      const q3 = datos.validoActividades !== undefined
        ? Boolean(datos.validoActividades)
        : (datos.recomiendaAprobacion !== undefined ? Boolean(datos.recomiendaAprobacion) : true);

      const analisis = (
        datos.analisisRecomendaciones ||
        datos.observacionesPlan ||
        datos.observacionesMejora ||
        'Las actividades y el certificado adjunto cumplen con los requisitos academicos de convalidacion.'
      ).trim();

      const horasValidadas = datos.horasValidadasSugeridas !== undefined
        ? Number(datos.horasValidadasSugeridas)
        : (formulario.totalHoras || aula.horasRequeridas);

      if (isNaN(horasValidadas) || horasValidadas <= 0 || horasValidadas > aula.horasRequeridas) {
        throw errorHttp(
          `Las horas validadas sugeridas deben ser mayores a 0 y no superar las ${aula.horasRequeridas}h solicitadas`,
          400
        );
      }

      formulario.seguimientoTutor = {
        conformidadPlan: true,
        observacionesPlan: analisis,
        novedades: 'Evaluacion de convalidacion FCP-001A (Seccion 9) completada por el docente tutor.',
        actividadesSeguimiento: [],
        evaluacionCualitativaTutor: {
          recomiendaEntidad: q1,
          aportaPerfilEgreso: q2,
          recomiendaAprobacion: q3
        },
        unidadAcademica: (datos.unidadAcademica || 'ESFOT').trim(),
        observacionesMejora: datos.observacionesMejora || analisis,
        horasValidadasSugeridas: horasValidadas,
        completadoPorTutor: true,
        fechaRevisionTutor: new Date()
      };

      formulario.estado = 'pendiente_comision';
      await formulario.save();

      return {
        success: true,
        message: 'Seccion 9 del FCP-001A completada por el docente tutor. Expediente listo para aprobacion y envio a la Comision.',
        formulario
      };
    }

    // Tutor completa y valida el punto 6 del F_AA_119 con los seguimientos
    const actividadesSeguimiento = Array.isArray(datos.actividadesSeguimiento) && datos.actividadesSeguimiento.length > 0
      ? datos.actividadesSeguimiento
      : [
          {
            actividad: 'Contacto inicial con el estudiante para obtener información de las prácticas',
            fecha: aula.fechaInicio || new Date(),
            resultados: 'El estudiante proporciona detalles sobre las actividades que está llevando a cabo en la empresa mediante reunión virtual'
          },
          {
            actividad: 'Llamada telefónica al tutor de prácticas, Supervisor de las Prácticas',
            fecha: new Date(),
            resultados: 'Se conoce el desempeño del estudiante en sus responsabilidades asignadas'
          },
          {
            actividad: 'Revisión de la Documentación',
            fecha: new Date(),
            resultados: 'Se revisa el formulario F_AA_119'
          }
        ];

    formulario.seguimientoTutor = {
      conformidadPlan: datos.conformidadPlan !== undefined ? Boolean(datos.conformidadPlan) : true,
      observacionesPlan: datos.observacionesPlan || 'Las actividades realizadas se cumplen segun lo planificado.',
      novedades: datos.novedades || 'Las practicas preprofesionales se llevaron a cabo con normalidad.',
      actividadesSeguimiento,
      evaluacionCualitativaTutor: {
        recomiendaEntidad: datos.recomiendaEntidad !== undefined ? Boolean(datos.recomiendaEntidad) : true,
        aportaPerfilEgreso: datos.aportaPerfilEgreso !== undefined ? Boolean(datos.aportaPerfilEgreso) : true,
        recomiendaAprobacion: datos.recomiendaAprobacion !== undefined ? Boolean(datos.recomiendaAprobacion) : true
      },
      unidadAcademica: datos.unidadAcademica || 'ESFOT',
      observacionesMejora: datos.observacionesMejora || 'Desempeño y aplicación de conocimientos satisfactorios.',
      horasValidadasSugeridas: formulario.totalHoras || aula.horasRequeridas,
      completadoPorTutor: true,
      fechaRevisionTutor: new Date()
    };

    formulario.estado = 'pendiente_comision';
    await formulario.save();

    return {
      success: true,
      message: 'Seguimiento y evaluacion docente registrados. Formulario remitido a la Comision de Practicas (CPP).',
      formulario
    };
  },

  // Consulta los expedientes remitidos para dictamen del Administrador
  async listarExpedientesPendientesComision() {
    const formularios = await FormularioPendiente.find({
      estado: { $in: ['aprobado_docente', 'pendiente_comision'] }
    })
      .populate('estudiante', 'nombres apellidos cedula correo')
      .sort({ updatedAt: -1 });

    const aulaIds = formularios.map((f) => f.aulaVirtual).filter(Boolean);
    const [aulasLab, aulasConv] = await Promise.all([
      AulaVirtual.find({ _id: { $in: aulaIds } }),
      AulaConvalidacion.find({ _id: { $in: aulaIds } })
    ]);

    const mapaAulas = new Map();
    for (const a of aulasLab) mapaAulas.set(a._id.toString(), { aula: a, esConv: false });
    for (const a of aulasConv) mapaAulas.set(a._id.toString(), { aula: a, esConv: true });

    return {
      success: true,
      total: formularios.length,
      expedientes: formularios.map((f) => {
        const info = f.aulaVirtual ? mapaAulas.get(f.aulaVirtual.toString()) : null;
        return formatearDatosGeneralesFormulario(f, info?.aula || null, info?.esConv ?? (f.tipoAula === 'convalidacion'));
      })
    };
  },

  // Veredicto final del Administrador: aprobar (mueve a formularios_aprobados y cierra aula) o rechazar (devuelve al docente)
  async dictamenFinalComision(aulaId, adminId, datos = {}) {
    const { aula, esConvalidacion } = await buscarAulaPorId(aulaId, { populateEstudiante: true });
    if (!aula) throw errorHttp('Aula virtual no encontrada', 404);

    if (aula.estado === ESTADOS_AULA.CERRADA) {
      throw errorHttp('Esta aula virtual ya fue cerrada formalmente con anterioridad', 400);
    }

    let formulario = await FormularioPendiente.findOne({ aulaVirtual: aulaId });
    if (!formulario) throw errorHttp('No se encontro el formulario pendiente del aula', 404);

    const aprobado = datos.dictamen
      ? datos.dictamen !== 'No Aprobado'
      : Boolean(datos.avalaAprobacion === true || String(datos.avalaAprobacion).toLowerCase() === 'true');
    const observaciones = (datos.observaciones ?? '').trim();

    if (!aprobado) {
      if (!observaciones) {
        throw errorHttp('Debe ingresar las observaciones al devolver el expediente al docente tutor', 400);
      }

      formulario.estado = 'devuelto_a_tutor';
      formulario.resolucionComision = {
        avalaAprobacion: false,
        observacionesComision: observaciones,
        fechaResolucion: new Date(),
        revisadoPorAdmin: adminId
      };
      await formulario.save();

      return {
        success: true,
        message: 'Expediente devuelto al docente tutor con observaciones del administrador.',
        dictamen: 'No Aprobado',
        observaciones,
        formularioEstado: formulario.estado
      };
    }

    let horasFinales;
    if (esConvalidacion) {
      horasFinales = datos.horasAprobadas !== undefined
        ? Number(datos.horasAprobadas)
        : (formulario.seguimientoTutor?.horasValidadasSugeridas || formulario.totalHoras || aula.horasRequeridas);
    } else {
      const resumen = await actividadService.calcularHorasAula(aulaId);
      horasFinales = resumen.horasAprobadas || formulario.totalHoras;
    }

    formulario.estado = 'aprobado';
    formulario.totalHoras = horasFinales;
    formulario.resolucionComision = {
      avalaAprobacion: true,
      horasAprobadasLaborales: aula.modalidad === MODALIDADES.LABORAL ? horasFinales : null,
      horasAprobadasComunitarias: aula.modalidad === MODALIDADES.COMUNITARIO ? horasFinales : null,
      observacionesComision: observaciones || 'Aprobado formalmente por el administrador.',
      fechaResolucion: new Date(),
      revisadoPorAdmin: adminId
    };

    const datosFormulario = typeof formulario.toObject === 'function' ? formulario.toObject() : { ...formulario };
    delete datosFormulario._id;
    delete datosFormulario.__v;

    const formularioAprobado = await FormularioAprobacion.findOneAndUpdate(
      { aulaVirtual: aulaId },
      { $set: datosFormulario },
      { upsert: true, new: true }
    );

    await FormularioPendiente.deleteOne({ _id: formulario._id });

    aula.estado = ESTADOS_AULA.CERRADA;
    await aula.save();

    return {
      success: true,
      message: 'Practica aprobada definitivamente por el administrador y movida a formularios_aprobados.',
      formulario: formatearDatosGeneralesFormulario(formularioAprobado, aula, esConvalidacion),
      aulaEstado: aula.estado
    };
  },

  // Genera y transmite el informe tecnico en Excel oficial para estudiante o docente
  async descargarInformeExcel(aulaId, usuarioId) {
    const { aula, esConvalidacion } = await buscarAulaPorId(aulaId, { populateEstudiante: true, populateDocente: true });

    if (!aula) throw errorHttp('Aula virtual no encontrada', 404);

    const esEstudiante = aula.estudiante?._id?.toString() === usuarioId.toString();
    const esDocente = aula.docenteTutor?._id?.toString() === usuarioId.toString();

    if (!esEstudiante && !esDocente) {
      throw errorHttp('No tienes permiso para descargar el formulario de esta aula', 403);
    }

    const formPendiente =
      (await FormularioPendiente.findOne({ aulaVirtual: aulaId })) ||
      (await FormularioAprobacion.findOne({ aulaVirtual: aulaId }));
    if (!formPendiente) {
      throw errorHttp(
        'Primero debe generar el borrador del informe antes de poder descargarlo en Excel',
        400
      );
    }

    if (esConvalidacion || formPendiente.tipoAula === 'convalidacion') {
      return await excelService.generarExcelInformeConvalidacionFcp001a({
        aula,
        estudiante: aula.estudiante,
        docente: aula.docenteTutor,
        formularioPendiente: formPendiente
      });
    }

    if (aula.modalidad === MODALIDADES.LABORAL) {
      return await excelService.generarExcelInformeLaboral({
        aula,
        estudiante: aula.estudiante,
        docente: aula.docenteTutor,
        formularioPendiente: formPendiente
      });
    } else {
      return await excelService.generarExcelInformeComunitario({
        aula,
        estudiante: aula.estudiante,
        docente: aula.docenteTutor,
        formularioPendiente: formPendiente
      });
    }
  }
};
