import { adminOrchestrator } from '../../application/orchestrators/adminOrchestrator.js';

export const adminController = {
  // Usuarios
  async crearUsuario(req, res, next) {
    try {
      const usuario = await adminOrchestrator.crearUsuario(req.body);
      res.status(201).json({
        success: true,
        message: 'Usuario registrado exitosamente',
        datos: usuario
      });
    } catch (error) {
      next(error);
    }
  },

  async listarUsuarios(req, res, next) {
    try {
      const usuarios = await adminOrchestrator.listarUsuarios(req.query);
      res.json({
        success: true,
        total: usuarios.length,
        datos: usuarios
      });
    } catch (error) {
      next(error);
    }
  },

  async obtenerUsuario(req, res, next) {
    try {
      const usuario = await adminOrchestrator.obtenerUsuario(req.params.id);
      res.json({
        success: true,
        datos: usuario
      });
    } catch (error) {
      next(error);
    }
  },

  async actualizarUsuario(req, res, next) {
    try {
      const usuario = await adminOrchestrator.actualizarUsuario(req.params.id, req.body);
      res.json({
        success: true,
        message: 'Usuario actualizado correctamente',
        datos: usuario
      });
    } catch (error) {
      next(error);
    }
  },

  async cambiarEstadoUsuario(req, res, next) {
    try {
      const estado = req.body.estado || req.query.estado;
      const usuario = await adminOrchestrator.cambiarEstadoUsuario(req.params.id, estado);
      res.json({
        success: true,
        message: `Estado del usuario actualizado a '${estado}'`,
        datos: usuario
      });
    } catch (error) {
      next(error);
    }
  },

  // Aulas Virtuales
  async crearAula(req, res, next) {
    try {
      const aula = await adminOrchestrator.crearAula(req.body);
      res.status(201).json({
        success: true,
        message: 'Aula virtual creada y parametrizada con exito',
        datos: aula
      });
    } catch (error) {
      next(error);
    }
  },

  async listarAulas(req, res, next) {
    try {
      const aulas = await adminOrchestrator.listarAulas(req.query);
      res.json({
        success: true,
        total: aulas.length,
        datos: aulas
      });
    } catch (error) {
      next(error);
    }
  },

  async obtenerAula(req, res, next) {
    try {
      const aula = await adminOrchestrator.obtenerAula(req.params.id);
      res.json({
        success: true,
        datos: aula
      });
    } catch (error) {
      next(error);
    }
  },

  async actualizarAula(req, res, next) {
    try {
      const aula = await adminOrchestrator.actualizarAula(req.params.id, req.body);
      res.json({
        success: true,
        message: 'Aula virtual actualizada correctamente',
        datos: aula
      });
    } catch (error) {
      next(error);
    }
  },

  async cambiarEstadoAula(req, res, next) {
    try {
      const estado = req.body.estado || req.query.estado;
      const aula = await adminOrchestrator.cambiarEstadoAula(req.params.id, estado);
      res.json({
        success: true,
        message: `Estado del aula virtual actualizado a '${estado}'`,
        datos: aula
      });
    } catch (error) {
      next(error);
    }
  },

  async asignarEstudiante(req, res, next) {
    try {
      const estudianteId = req.body.estudianteId || req.body.estudiante;
      const aula = await adminOrchestrator.asignarEstudiante(req.params.id, estudianteId);
      res.json({
        success: true,
        message: 'Estudiante asignado al aula virtual exitosamente',
        datos: aula
      });
    } catch (error) {
      next(error);
    }
  },

  async desasignarEstudiante(req, res, next) {
    try {
      const aula = await adminOrchestrator.desasignarEstudiante(req.params.id);
      res.json({
        success: true,
        message: 'Estudiante desvinculado del aula virtual exitosamente',
        datos: aula
      });
    } catch (error) {
      next(error);
    }
  },

  // Fuentes Normativas RAG
  async ingestarFuente(req, res, next) {
    try {
      const fuente = await adminOrchestrator.ingestarFuente(req.body, req.usuario?._id || req.usuario?.id);
      const totalFragmentos = fuente.fragmentos ? fuente.fragmentos.length : 0;
      res.status(201).json({
        success: true,
        message: 'Documento normativo procesado, fragmentado e indexado exitosamente para la IA',
        totalFragmentos,
        datos: fuente,
        fuente: {
          id: fuente._id?.toString() || fuente.id,
          _id: fuente._id,
          titulo: fuente.titulo,
          categoria: fuente.categoria,
          descripcion: fuente.descripcion,
          version: fuente.version,
          activo: fuente.activo,
          enlaceUrl: fuente.enlaceUrl,
          totalFragmentos,
          createdAt: fuente.createdAt,
          updatedAt: fuente.updatedAt
        }
      });
    } catch (error) {
      next(error);
    }
  },

  async listarFuentes(req, res, next) {
    try {
      const fuentes = await adminOrchestrator.listarFuentes(req.query);
      res.json({
        success: true,
        total: fuentes.length,
        datos: fuentes,
        fuentes: fuentes
      });
    } catch (error) {
      next(error);
    }
  },

  async obtenerFuente(req, res, next) {
    try {
      const fuente = await adminOrchestrator.obtenerFuente(req.params.id);
      res.json({
        success: true,
        datos: fuente,
        fuente: fuente
      });
    } catch (error) {
      next(error);
    }
  },

  async actualizarFuente(req, res, next) {
    try {
      const fuente = await adminOrchestrator.actualizarFuente(req.params.id, req.body);
      res.json({
        success: true,
        message: 'Fuente institucional actualizada correctamente',
        datos: fuente,
        fuente: fuente
      });
    } catch (error) {
      next(error);
    }
  },

  async cambiarEstadoFuente(req, res, next) {
    try {
      const activo = req.body.activo !== undefined ? req.body.activo : req.query.activo;
      const fuente = await adminOrchestrator.cambiarEstadoFuente(req.params.id, activo);
      res.json({
        success: true,
        message: 'Vigencia de la fuente actualizada correctamente',
        datos: fuente
      });
    } catch (error) {
      next(error);
    }
  }
};
