import { docenteOrchestrator } from '../../application/orchestrators/docenteOrchestrator.js';

export const docenteController = {
  async listarAulas(req, res, next) {
    try {
      const resultado = await docenteOrchestrator.listarAulas(req.usuario.id);
      res.json(resultado);
    } catch (error) {
      next(error);
    }
  },

  async obtenerDetalleAula(req, res, next) {
    try {
      const { aulaId } = req.params;
      const resultado = await docenteOrchestrator.obtenerDetalleAula(aulaId, req.usuario.id);
      res.json(resultado);
    } catch (error) {
      next(error);
    }
  },

  async listarActividadesLaborales(req, res, next) {
    try {
      const { aulaId } = req.params;
      const resultado = await docenteOrchestrator.listarActividadesLaborales(aulaId, req.query);
      res.json(resultado);
    } catch (error) {
      next(error);
    }
  },

  async evaluarActividadLaboral(req, res, next) {
    try {
      const { actividadId } = req.params;
      const resultado = await docenteOrchestrator.evaluarActividadLaboral(actividadId, req.usuario.id, req.body);
      res.json(resultado);
    } catch (error) {
      next(error);
    }
  },

  async listarActividadesComunitarias(req, res, next) {
    try {
      const { aulaId } = req.params;
      const resultado = await docenteOrchestrator.listarActividadesComunitarias(aulaId, req.query);
      res.json(resultado);
    } catch (error) {
      next(error);
    }
  },

  async evaluarActividadComunitaria(req, res, next) {
    try {
      const { actividadId } = req.params;
      const resultado = await docenteOrchestrator.evaluarActividadComunitaria(actividadId, req.usuario.id, req.body);
      res.json(resultado);
    } catch (error) {
      next(error);
    }
  },

  async listarConvalidaciones(req, res, next) {
    try {
      const { aulaId } = req.params;
      const resultado = await docenteOrchestrator.listarConvalidaciones(aulaId);
      res.json(resultado);
    } catch (error) {
      next(error);
    }
  },

  async evaluarConvalidacion(req, res, next) {
    try {
      const { certificadoId } = req.params;
      const resultado = await docenteOrchestrator.evaluarConvalidacion(certificadoId, req.body);
      res.json({
        success: true,
        message: 'Certificado evaluado correctamente por el docente tutor',
        certificado: resultado
      });
    } catch (error) {
      next(error);
    }
  },

  async obtenerFormularioPendiente(req, res, next) {
    try {
      const { aulaId } = req.params;
      const formulario = await docenteOrchestrator.obtenerFormularioPendiente(aulaId);
      res.json({ success: true, formulario });
    } catch (error) {
      next(error);
    }
  },

  async cerrarPractica(req, res, next) {
    try {
      const { aulaId } = req.params;
      const resultado = await docenteOrchestrator.cerrarPractica(aulaId, req.usuario.id, req.body);
      res.json(resultado);
    } catch (error) {
      next(error);
    }
  },

  async descargarInforme(req, res, next) {
    try {
      const { aulaId } = req.params;
      const { buffer, filename } = await docenteOrchestrator.descargarInforme(aulaId, req.usuario.id);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', buffer.length);
      return res.status(200).send(buffer);
    } catch (error) {
      next(error);
    }
  }
};
