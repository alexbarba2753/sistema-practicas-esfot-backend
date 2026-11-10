import { estudianteOrchestrator } from '../../application/orchestrators/estudianteOrchestrator.js';

export const estudianteController = {
  async obtenerAulas(req, res, next) {
    try {
      const resultado = await estudianteOrchestrator.obtenerAulas(req.usuario.id);
      res.json(resultado);
    } catch (error) {
      next(error);
    }
  },

  async consultarAsistenteIa(req, res, next) {
    try {
      const { pregunta } = req.body;
      const resultado = await estudianteOrchestrator.consultarNormativa(pregunta);
      res.json(resultado);
    } catch (error) {
      next(error);
    }
  },

  async crearActividadLaboral(req, res, next) {
    try {
      const { aulaId } = req.params;
      const resultado = await estudianteOrchestrator.crearActividadLaboral(req.usuario.id, aulaId, req.body);
      res.status(201).json(resultado);
    } catch (error) {
      next(error);
    }
  },

  async listarActividadesLaborales(req, res, next) {
    try {
      const { aulaId } = req.params;
      const resultado = await estudianteOrchestrator.listarActividadesLaborales(aulaId, req.query);
      res.json(resultado);
    } catch (error) {
      next(error);
    }
  },

  async actualizarActividadLaboral(req, res, next) {
    try {
      const { actividadId } = req.params;
      const resultado = await estudianteOrchestrator.actualizarActividadLaboral(req.usuario.id, actividadId, req.body);
      res.json(resultado);
    } catch (error) {
      next(error);
    }
  },

  async crearActividadComunitaria(req, res, next) {
    try {
      const { aulaId } = req.params;
      const resultado = await estudianteOrchestrator.crearActividadComunitaria(req.usuario.id, aulaId, req.body);
      res.status(201).json(resultado);
    } catch (error) {
      next(error);
    }
  },

  async listarActividadesComunitarias(req, res, next) {
    try {
      const { aulaId } = req.params;
      const resultado = await estudianteOrchestrator.listarActividadesComunitarias(aulaId, req.query);
      res.json(resultado);
    } catch (error) {
      next(error);
    }
  },

  async actualizarActividadComunitaria(req, res, next) {
    try {
      const { actividadId } = req.params;
      const resultado = await estudianteOrchestrator.actualizarActividadComunitaria(req.usuario.id, actividadId, req.body);
      res.json(resultado);
    } catch (error) {
      next(error);
    }
  },

  async registrarCertificado(req, res, next) {
    try {
      const { aulaId } = req.params;
      const resultado = await estudianteOrchestrator.registrarCertificado(req.usuario.id, aulaId, req.body);
      res.status(201).json(resultado);
    } catch (error) {
      next(error);
    }
  },

  async listarCertificados(req, res, next) {
    try {
      const { aulaId } = req.params;
      const resultado = await estudianteOrchestrator.listarCertificados(aulaId);
      res.json(resultado);
    } catch (error) {
      next(error);
    }
  },

  async actualizarCertificado(req, res, next) {
    try {
      const { certificadoId } = req.params;
      const resultado = await estudianteOrchestrator.actualizarCertificado(req.usuario.id, certificadoId, req.body);
      res.json(resultado);
    } catch (error) {
      next(error);
    }
  },

  async obtenerFormularioPendiente(req, res, next) {
    try {
      const { aulaId } = req.params;
      const formulario = await estudianteOrchestrator.obtenerFormularioPendiente(aulaId);
      res.json({ success: true, formulario });
    } catch (error) {
      next(error);
    }
  },

  async actualizarFormularioPendiente(req, res, next) {
    try {
      const { aulaId } = req.params;
      const formulario = await estudianteOrchestrator.actualizarFormularioPendiente(aulaId, req.usuario.id, req.body);
      res.json({
        success: true,
        message: 'Formulario actualizado correctamente',
        formulario
      });
    } catch (error) {
      next(error);
    }
  },

  async generarBorradorInforme(req, res, next) {
    try {
      const { aulaId } = req.params;
      const resultado = await estudianteOrchestrator.generarBorradorInforme(aulaId, req.usuario.id);
      res.json(resultado);
    } catch (error) {
      next(error);
    }
  },

  async entregarExpediente(req, res, next) {
    try {
      const { aulaId } = req.params;
      const resultado = await estudianteOrchestrator.entregarExpediente(aulaId, req.usuario.id);
      res.json(resultado);
    } catch (error) {
      next(error);
    }
  },

  async descargarInforme(req, res, next) {
    try {
      const { aulaId } = req.params;
      const { buffer, filename } = await estudianteOrchestrator.descargarInforme(aulaId, req.usuario.id);
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
