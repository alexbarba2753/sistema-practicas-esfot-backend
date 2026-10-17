import { AulaVirtual } from '../../infrastructure/database/models/AulaVirtual.js';
import { FormularioPendiente } from '../../infrastructure/database/models/FormularioPendiente.js';
import { FormularioAprobacion } from '../../infrastructure/database/models/FormularioAprobacion.js';
import { actividadService } from './actividadService.js';
import { convalidacionService } from './convalidacionService.js';
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
  }
};
