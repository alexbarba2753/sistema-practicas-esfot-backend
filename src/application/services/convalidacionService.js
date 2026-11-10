import { ConvalidacionCertificado } from '../../infrastructure/database/models/ConvalidacionCertificado.js';
import { AulaVirtual } from '../../infrastructure/database/models/AulaVirtual.js';
import { ESTADOS_AULA } from '../../domain/constants/practicasConstants.js';
import { actividadService } from './actividadService.js';
import { errorHttp } from '../../domain/utils/errorHttp.js';

export const convalidacionService = {
  // Registra un certificado externo (Udemy, Cisco, Google, etc.) para convalidacion y deduccion de horas
  async registrarCertificado(estudianteId, aulaId, datos) {
    const aula = await AulaVirtual.findById(aulaId);
    if (!aula) throw errorHttp('Aula virtual no encontrada', 404);

    if (aula.estudiante?.toString() !== estudianteId.toString()) {
      throw errorHttp('No tienes permiso para registrar certificados en esta aula virtual', 403);
    }

    if (aula.estado !== ESTADOS_AULA.ABIERTA) {
      throw errorHttp('El aula virtual se encuentra cerrada; no se permiten nuevos registros de convalidacion', 400);
    }

    if (aula.expedienteEntregado) {
      throw errorHttp('El expediente ya fue entregado a revision; no se pueden anadir mas certificados', 400);
    }

    const { plataforma, nombreCurso, horasCertificadas, codigoCertificado, enlaceCredencial } = datos;

    if (!plataforma || !nombreCurso || !horasCertificadas) {
      throw errorHttp('Plataforma emisora, nombre del curso y horas certificadas son obligatorios', 400);
    }

    const numHoras = Number(horasCertificadas);
    if (isNaN(numHoras) || numHoras <= 0) {
      throw errorHttp('El numero de horas certificadas debe ser un valor positivo', 400);
    }

    const nuevoCertificado = new ConvalidacionCertificado({
      estudiante: estudianteId,
      aulaVirtual: aulaId,
      plataforma: plataforma.trim(),
      nombreCurso: nombreCurso.trim(),
      codigoCertificado: codigoCertificado ? codigoCertificado.trim() : '',
      horasCertificadas: numHoras,
      horasAcreditadas: 0,
      enlaceCredencial: enlaceCredencial ? enlaceCredencial.trim() : '',
      estado: 'pendiente'
    });

    await nuevoCertificado.save();

    const resumenHoras = await actividadService.calcularHorasAula(aulaId);

    return {
      success: true,
      message: `Certificado de formacion continua registrado para auditoria y convalidacion. Se sumaron ${numHoras} horas pendientes al aula.`,
      certificado: nuevoCertificado,
      horasPendientes: resumenHoras.horasPendientes,
      resumenHoras
    };
  },

  async listarCertificados(aulaId) {
    const certificados = await ConvalidacionCertificado.find({ aulaVirtual: aulaId }).sort({ createdAt: -1 });

    let horasConvalidadas = 0;
    let horasEnRevision = 0;

    for (const cert of certificados) {
      if (cert.estado === 'aprobada') {
        horasConvalidadas += cert.horasAcreditadas || cert.horasCertificadas;
      } else if (cert.estado === 'pendiente') {
        horasEnRevision += cert.horasCertificadas;
      }
    }

    return {
      success: true,
      total: certificados.length,
      horasConvalidadas,
      horasEnRevision,
      certificados
    };
  },

  async evaluarCertificado(id, datosEvaluacion) {
    const certificado = await ConvalidacionCertificado.findById(id);
    if (!certificado) throw errorHttp('Certificado no encontrado', 404);

    const { aprobada, horasAcreditadas, observaciones, observacionesDocente } = datosEvaluacion;
    const esAprobada = Boolean(aprobada === true || String(aprobada).toLowerCase() === 'true');

    certificado.estado = esAprobada ? 'aprobada' : 'rechazada';
    // Si se aprueba, se acreditan las horas completas del certificado (o las indicadas explícitamente)
    certificado.horasAcreditadas = esAprobada
      ? (horasAcreditadas !== undefined && horasAcreditadas !== null && horasAcreditadas !== ''
          ? Number(horasAcreditadas)
          : certificado.horasCertificadas)
      : 0;

    const obs = observaciones !== undefined ? observaciones : observacionesDocente;
    if (obs !== undefined) {
      certificado.observacionesDocente = String(obs).trim();
    }

    await certificado.save();

    const resumenHoras = await actividadService.calcularHorasAula(certificado.aulaVirtual);
    if (certificado._doc) {
      certificado._doc.resumenHoras = resumenHoras;
    } else {
      certificado.resumenHoras = resumenHoras;
    }

    return certificado;
  },

  // Permite al estudiante actualizar un certificado externo siempre que no haya sido aprobado
  async actualizarCertificado(estudianteId, certificadoId, datos, aulaIdOpcional = null) {
    const certificado = await ConvalidacionCertificado.findById(certificadoId);
    if (!certificado) throw errorHttp('Certificado no encontrado', 404);

    if (certificado.estudiante?.toString() !== estudianteId.toString()) {
      throw errorHttp('No tienes permiso para modificar este certificado', 403);
    }

    if (aulaIdOpcional && certificado.aulaVirtual?.toString() !== aulaIdOpcional.toString()) {
      throw errorHttp('El certificado no pertenece al aula virtual especificada', 400);
    }

    if (certificado.estado === 'aprobada') {
      throw errorHttp('No se puede modificar un certificado que ya ha sido aprobado', 400);
    }

    const aula = await AulaVirtual.findById(certificado.aulaVirtual);
    if (!aula || aula.estado !== ESTADOS_AULA.ABIERTA) {
      throw errorHttp('El aula virtual se encuentra cerrada; no se permiten modificaciones', 400);
    }

    if (aula.expedienteEntregado) {
      throw errorHttp('El expediente ya fue entregado a revision; no se pueden modificar certificados', 400);
    }

    const { plataforma, nombreCurso, horasCertificadas, codigoCertificado, enlaceCredencial } = datos;

    if (plataforma !== undefined) {
      if (!plataforma.trim()) throw errorHttp('La plataforma emisora no puede estar vacia', 400);
      certificado.plataforma = plataforma.trim();
    }
    if (nombreCurso !== undefined) {
      if (!nombreCurso.trim()) throw errorHttp('El nombre del curso no puede estar vacio', 400);
      certificado.nombreCurso = nombreCurso.trim();
    }
    if (horasCertificadas !== undefined) {
      const numHoras = Number(horasCertificadas);
      if (isNaN(numHoras) || numHoras <= 0) {
        throw errorHttp('El numero de horas certificadas debe ser un valor positivo', 400);
      }
      certificado.horasCertificadas = numHoras;
    }
    if (codigoCertificado !== undefined) {
      certificado.codigoCertificado = codigoCertificado.trim();
    }
    if (enlaceCredencial !== undefined) {
      certificado.enlaceCredencial = enlaceCredencial.trim();
    }

    // Al ser modificado por el estudiante, regresa a revision y reinicia horas acreditadas
    certificado.estado = 'pendiente';
    certificado.horasAcreditadas = 0;
    certificado.observacionesDocente = '';

    await certificado.save();

    const resumenHoras = await actividadService.calcularHorasAula(certificado.aulaVirtual);

    return {
      success: true,
      message: 'Certificado actualizado exitosamente y puesto en revision para el docente tutor',
      certificado,
      resumenHoras
    };
  }
};
