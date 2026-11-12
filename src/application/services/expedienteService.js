import { AulaVirtual } from '../../infrastructure/database/models/AulaVirtual.js';
import { FormularioPendiente } from '../../infrastructure/database/models/FormularioPendiente.js';
import { FormularioAprobacion } from '../../infrastructure/database/models/FormularioAprobacion.js';
import { ESTADOS_AULA, MODALIDADES } from '../../domain/constants/practicasConstants.js';
import { actividadService } from './actividadService.js';
import { convalidacionService } from './convalidacionService.js';
import { excelService } from './excelService.js';
import { errorHttp } from '../../domain/utils/errorHttp.js';

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
        const convalidaciones = await convalidacionService.listarCertificados(aula._id);
        return {
          _id: aula._id,
          nombre: aula.nombre,
          periodo: aula.periodo,
          modalidad: aula.modalidad,
          horasRequeridas: aula.horasRequeridas,
          fechaInicio: aula.fechaInicio,
          fechaFin: aula.fechaFin,
          estado: aula.estado,
          expedienteEntregado: aula.expedienteEntregado,
          docenteTutor: aula.docenteTutor,
          resumenHoras: resumen,
          horasConvalidadas: convalidaciones.horasConvalidadas
        };
      })
    );

    return {
      success: true,
      total: aulasConProgreso.length,
      aulas: aulasConProgreso
    };
  },

  async obtenerFormularioPendiente(aulaId) {
    let formulario = await FormularioPendiente.findOne({ aulaVirtual: aulaId });
    if (!formulario) {
      const aula = await AulaVirtual.findById(aulaId);
      if (!aula) throw errorHttp('Aula virtual no encontrada', 404);

      formulario = new FormularioPendiente({
        aulaVirtual: aulaId,
        estudiante: aula.estudiante,
        modalidad: aula.modalidad,
        totalHoras: 0
      });
      await formulario.save();
    }
    return formulario;
  },

  async actualizarFormularioPendiente(aulaId, estudianteId, datos) {
    const aula = await AulaVirtual.findById(aulaId);
    if (!aula) throw errorHttp('Aula virtual no encontrada', 404);

    if (aula.estudiante?.toString() !== estudianteId.toString()) {
      throw errorHttp('No tienes permiso para modificar este formulario', 403);
    }

    let formulario = await FormularioPendiente.findOne({ aulaVirtual: aulaId });
    if (!formulario) {
      formulario = new FormularioPendiente({
        aulaVirtual: aulaId,
        estudiante: estudianteId,
        modalidad: aula.modalidad
      });
    }

    if (datos.entidadReceptora) {
      formulario.entidadReceptora = { ...formulario.entidadReceptora.toObject(), ...datos.entidadReceptora };
    }

    if (datos.horarioSemanal) {
      formulario.horarioSemanal = { ...formulario.horarioSemanal.toObject(), ...datos.horarioSemanal };
    }

    if (datos.contenidoIa) {
      formulario.contenidoIa = { ...formulario.contenidoIa.toObject(), ...datos.contenidoIa };
    }

    formulario.ultimaEdicionEstudiante = new Date();
    await formulario.save();

    return formulario;
  },

  // Entrega formal del expediente completo de practicas al docente tutor para su calificacion
  async entregarExpediente(aulaId, estudianteId) {
    const aula = await AulaVirtual.findById(aulaId);
    if (!aula) throw errorHttp('Aula virtual no encontrada', 404);

    if (aula.estudiante?.toString() !== estudianteId.toString()) {
      throw errorHttp('No tienes permiso para entregar este expediente', 403);
    }

    if (aula.expedienteEntregado) {
      throw errorHttp('El expediente ya fue entregado previamente para revision', 400);
    }

    const resumen = await actividadService.calcularHorasAula(aulaId);
    if (!resumen.cumplioRequisito) {
      throw errorHttp(
        `No se puede entregar el expediente: Se requieren ${aula.horasRequeridas}h y actualmente tienes ${resumen.horasAprobadas}h aprobadas`,
        400
      );
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
      message: 'Expediente de practicas entregado formalmente al docente tutor para su aprobacion',
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
        const convalidaciones = await convalidacionService.listarCertificados(aula._id);
        return {
          _id: aula._id,
          nombre: aula.nombre,
          periodo: aula.periodo,
          modalidad: aula.modalidad,
          horasRequeridas: aula.horasRequeridas,
          fechaInicio: aula.fechaInicio,
          fechaFin: aula.fechaFin,
          estado: aula.estado,
          expedienteEntregado: aula.expedienteEntregado,
          estudiante: aula.estudiante,
          resumenHoras: resumen,
          horasConvalidadas: convalidaciones.horasConvalidadas
        };
      })
    );

    return {
      success: true,
      total: aulasConProgreso.length,
      aulas: aulasConProgreso
    };
  },

  async obtenerDetalleAulaDocente(aulaId, docenteId) {
    const aula = await AulaVirtual.findOne({ _id: aulaId, docenteTutor: docenteId })
      .populate('docenteTutor', 'nombres apellidos correo telefono')
      .populate('estudiante', 'nombres apellidos correo cedula telefono estado');

    if (!aula) throw errorHttp('Aula virtual no encontrada o no asignada a este docente tutor', 404);

    const resumen = await actividadService.calcularHorasAula(aulaId);
    const convalidaciones = await convalidacionService.listarCertificados(aulaId);
    const formulario = await FormularioPendiente.findOne({ aulaVirtual: aulaId });
    const actaAprobacion = await FormularioAprobacion.findOne({ aulaVirtual: aulaId });

    return {
      success: true,
      aula: {
        _id: aula._id,
        nombre: aula.nombre,
        periodo: aula.periodo,
        modalidad: aula.modalidad,
        horasRequeridas: aula.horasRequeridas,
        fechaInicio: aula.fechaInicio,
        fechaFin: aula.fechaFin,
        estado: aula.estado,
        expedienteEntregado: aula.expedienteEntregado,
        fechaEntregaExpediente: aula.fechaEntregaExpediente,
        estudiante: aula.estudiante,
        docenteTutor: aula.docenteTutor,
        resumenHoras: resumen,
        horasConvalidadas: convalidaciones.horasConvalidadas,
        formularioPendiente: formulario,
        actaAprobacion
      }
    };
  },

  // Cierre formal de la practica, calificacion del tutor y emision del acta FCP-004
  async cerrarProcesoDocente(aulaId, docenteId, datos = {}) {
    const aula = await AulaVirtual.findOne({ _id: aulaId, docenteTutor: docenteId });
    if (!aula) throw errorHttp('Aula virtual no encontrada o no asignada a este docente tutor', 404);

    if (aula.estado === ESTADOS_AULA.CERRADA) {
      throw errorHttp('Esta aula virtual ya fue cerrada formalmente con anterioridad', 400);
    }

    if (!aula.expedienteEntregado) {
      throw errorHttp('El estudiante aun no ha entregado formalmente el expediente para revision', 400);
    }

    const resumen = await actividadService.calcularHorasAula(aulaId);
    if (resumen.horasAprobadas < aula.horasRequeridas) {
      throw errorHttp(
        `El estudiante aun no cumple con las horas reglamentarias (${resumen.horasAprobadas}/${aula.horasRequeridas} horas aprobadas)`,
        400
      );
    }

    const dictamenFinal = datos.dictamen === 'No Aprobado' ? 'No Aprobado' : 'Aprobado';
    const estadoFinal = dictamenFinal === 'Aprobado' ? 'aprobado' : 'rechazado';
    const calificacion = datos.calificacion !== undefined ? Number(datos.calificacion) : 20;

    if (isNaN(calificacion) || calificacion < 0 || calificacion > 20) {
      throw errorHttp('La calificacion debe ser un valor numerico entre 0 y 20 puntos', 400);
    }

    aula.estado = ESTADOS_AULA.CERRADA;
    await aula.save();

    let acta = await FormularioAprobacion.findOne({ aulaVirtual: aulaId });
    if (!acta) {
      acta = new FormularioAprobacion({
        estudiante: aula.estudiante,
        docenteTutor: docenteId,
        aulaVirtual: aulaId,
        modalidad: aula.modalidad,
        horasCompletadas: resumen.horasAprobadas,
        horasRequeridas: aula.horasRequeridas
      });
    }

    acta.dictamen = dictamenFinal;
    acta.calificacionTutor = calificacion;
    acta.observacionesFinales = datos.observacionesFinales ? datos.observacionesFinales.trim() : 'Cumplimiento satisfactorio de las horas reglamentarias.';
    acta.estado = estadoFinal;
    acta.fechaEmision = new Date();
    await acta.save();

    let formulario = await FormularioPendiente.findOne({ aulaVirtual: aulaId });
    if (formulario) {
      formulario.estado = estadoFinal;
      await formulario.save();
    }

    return {
      success: true,
      message: `Practica ${dictamenFinal === 'Aprobado' ? 'aprobada' : 'reprobada'} y cerrada formalmente. Acta FCP-004 emitida.`,
      actaAprobacion: acta,
      aulaEstado: aula.estado
    };
  },

  // Evaluacion de seguimiento del tutor academico (Punto 6 del F_AA_119 / Punto 9 del FCP_001A)
  async evaluarSeguimientoDocente(aulaId, docenteId, datos = {}) {
    const aula = await AulaVirtual.findOne({ _id: aulaId, docenteTutor: docenteId });
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

    // Tutor completa y valida el punto 6 con los 3 seguimientos
    const actividadesSeguimiento = Array.isArray(datos.actividadesSeguimiento) && datos.actividadesSeguimiento.length > 0
      ? datos.actividadesSeguimiento
      : [
          {
            actividad: 'Contacto inicial con el estudiante para coordinacion de practicas',
            fecha: aula.fechaInicio || new Date(),
            resultados: 'Planificacion y alineacion de tareas con el perfil de egreso'
          },
          {
            actividad: 'Llamada telefonica / reunion con el supervisor empresarial',
            fecha: new Date(),
            resultados: 'Verificacion satisfactoria del desempeno del practicante en la empresa'
          },
          {
            actividad: 'Revision integral de bitacoras y documentacion de informe F_AA_119',
            fecha: new Date(),
            resultados: 'Validacion de evidencias y horas tecnicas reportadas'
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

  // Consulta los expedientes remitidos para dictamen de la Comision de Practicas Preprofesionales (CPP)
  async listarExpedientesPendientesComision() {
    const formularios = await FormularioPendiente.find({
      estado: { $in: ['pendiente_comision', 'en_revision'] }
    })
      .populate('estudiante', 'nombres apellidos cedula correo telefono')
      .populate({
        path: 'aulaVirtual',
        populate: { path: 'docenteTutor', select: 'nombres apellidos cedula correo' }
      })
      .sort({ updatedAt: -1 });

    return {
      success: true,
      total: formularios.length,
      expedientes: formularios
    };
  },

  // Dictamen final por parte de la Comision de Practicas Preprofesionales / Administrador (Punto 7)
  async dictamenFinalComision(aulaId, adminId, datos = {}) {
    const aula = await AulaVirtual.findById(aulaId);
    if (!aula) throw errorHttp('Aula virtual no encontrada', 404);

    let formulario = await FormularioPendiente.findOne({ aulaVirtual: aulaId });
    if (!formulario) throw errorHttp('No se encontro el formulario pendiente del aula', 404);

    const avalaAprobacion = Boolean(datos.avalaAprobacion === true || String(datos.avalaAprobacion).toLowerCase() === 'true');

    if (!avalaAprobacion) {
      // Regresa al docente tutor con observaciones de la comision
      formulario.estado = 'devuelto_a_tutor';
      formulario.resolucionComision = {
        avalaAprobacion: false,
        observacionesComision: datos.observaciones || 'La Comision de Practicas solicita correcciones al tutor academico.',
        fechaResolucion: new Date(),
        revisadoPorAdmin: adminId
      };
      await formulario.save();

      return {
        success: true,
        message: 'Expediente devuelto al docente tutor para correcciones segun observaciones de la Comision',
        formulario
      };
    }

    // Si la comision aprueba, se cierra formalmente y se emite el acta oficial
    formulario.estado = 'aprobado';
    formulario.resolucionComision = {
      avalaAprobacion: true,
      observacionesComision: datos.observaciones || 'Aprobacion reglamentaria avalada por la Comision de Practicas.',
      fechaResolucion: new Date(),
      revisadoPorAdmin: adminId
    };
    await formulario.save();

    return await this.cerrarProcesoDocente(aulaId, aula.docenteTutor, {
      dictamen: 'Aprobado',
      calificacion: datos.calificacion || 20,
      observacionesFinales: datos.observaciones || 'Aprobado formalmente por la Comision de Practicas.'
    });
  },

  // Genera y transmite el informe tecnico en Excel oficial para estudiante o docente
  async descargarInformeExcel(aulaId, usuarioId) {
    const aula = await AulaVirtual.findById(aulaId)
      .populate('estudiante', 'nombres apellidos cedula correo telefono')
      .populate('docenteTutor', 'nombres apellidos cedula correo telefono');

    if (!aula) throw errorHttp('Aula virtual no encontrada', 404);

    const esEstudiante = aula.estudiante?._id?.toString() === usuarioId.toString();
    const esDocente = aula.docenteTutor?._id?.toString() === usuarioId.toString();

    if (!esEstudiante && !esDocente) {
      throw errorHttp('No tienes permiso para descargar el formulario de esta aula', 403);
    }

    const formPendiente = await FormularioPendiente.findOne({ aulaVirtual: aulaId });
    if (!formPendiente) {
      throw errorHttp(
        'Primero debe generar el borrador del informe antes de poder descargarlo en Excel',
        400
      );
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
