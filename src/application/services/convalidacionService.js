import { ConvalidacionCertificado } from '../../infrastructure/database/models/ConvalidacionCertificado.js';
import { AulaVirtual } from '../../infrastructure/database/models/AulaVirtual.js';
import { errorHttp } from '../../domain/utils/errorHttp.js';

export const convalidacionService = {
  // Registra un certificado externo (Udemy, Cisco, Google, etc.) para convalidacion y deduccion de horas
  async registrarCertificado(estudianteId, aulaId, datos) {
    const aula = await AulaVirtual.findById(aulaId);
    if (!aula) throw errorHttp('Aula virtual no encontrada', 404);

    if (aula.estudiante?.toString() !== estudianteId.toString()) {
      throw errorHttp('No tienes permiso para registrar certificados en esta aula virtual', 403);
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

    return {
      success: true,
      message: 'Certificado de formacion continua registrado para auditoria y convalidacion',
      certificado: nuevoCertificado
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

    const { aprobada, horasAcreditadas, observaciones } = datosEvaluacion;

    certificado.estado = aprobada ? 'aprobada' : 'rechazada';
    certificado.horasAcreditadas = aprobada ? (Number(horasAcreditadas) || certificado.horasCertificadas) : 0;
    if (observaciones) certificado.observacionesDocente = observaciones.trim();

    await certificado.save();
    return certificado;
  }
};
