import { Router } from 'express';
import { adminController } from '../controllers/adminController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/roleMiddleware.js';
import { procesarArchivoNormativo, uploadDocumento } from '../middlewares/uploadMiddleware.js';
import { ROLES } from '../../domain/constants/practicasConstants.js';

const router = Router();

// Todas las rutas de administracion requieren sesion activa y rol de administrador
router.use(authMiddleware, requireRole(ROLES.ADMINISTRADOR));

// 1. Administracion de Cuentas de Usuarios
router.post('/usuarios', adminController.crearUsuario);
router.get('/usuarios', adminController.listarUsuarios);
router.get('/usuarios/:id', adminController.obtenerUsuario);
router.put('/usuarios/:id', adminController.actualizarUsuario);
router.patch('/usuarios/:id/estado', adminController.cambiarEstadoUsuario);

// 2. Parametrizacion y Gestion de Aulas Virtuales
router.post('/aulas-virtuales', uploadDocumento.single('documento'), adminController.crearAula);
router.get('/aulas-virtuales/pendientes-comision', adminController.listarExpedientesPendientesComision);
router.post('/aulas-virtuales/:aulaId/dictamen-comision', adminController.dictamenFinalComision);
router.get('/aulas-virtuales', adminController.listarAulas);
router.get('/aulas-virtuales/:id', adminController.obtenerAula);
router.put('/aulas-virtuales/:id', adminController.actualizarAula);
router.patch('/aulas-virtuales/:id/estado', adminController.cambiarEstadoAula);
router.post('/aulas-virtuales/:id/estudiante', adminController.asignarEstudiante);
router.delete('/aulas-virtuales/:id/estudiante', adminController.desasignarEstudiante);

// 3. Ingesta y Gestion de Fuentes Normativas RAG
router.post('/fuentes', procesarArchivoNormativo, adminController.ingestarFuente);
router.get('/fuentes', adminController.listarFuentes);
router.get('/fuentes/:id', adminController.obtenerFuente);
router.put('/fuentes/:id', procesarArchivoNormativo, adminController.actualizarFuente);
router.patch('/fuentes/:id/estado', adminController.cambiarEstadoFuente);

export default router;
