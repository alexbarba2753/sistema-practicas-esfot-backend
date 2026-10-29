import { Router } from 'express';
import { docenteController } from '../controllers/docenteController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/roleMiddleware.js';
import { ROLES } from '../../domain/constants/practicasConstants.js';

const router = Router();

// Todas las rutas de docente requieren sesion activa y rol Docente
router.use(authMiddleware, requireRole(ROLES.DOCENTE));

// 1. Aulas virtuales asignadas y detalle
router.get('/aulas', docenteController.listarAulas);
router.get('/aulas/:aulaId', docenteController.obtenerDetalleAula);

// 2. Evaluacion de bitacora laboral FCP-002
router.get('/aulas/:aulaId/laborales', docenteController.listarActividadesLaborales);
router.put('/actividades/laborales/:actividadId/evaluar', docenteController.evaluarActividadLaboral);

// 3. Evaluacion de bitacora comunitaria FCP-002
router.get('/aulas/:aulaId/comunitarias', docenteController.listarActividadesComunitarias);
router.put('/actividades/comunitarias/:actividadId/evaluar', docenteController.evaluarActividadComunitaria);

// 4. Evaluacion de convalidaciones de cursos externos
router.get('/aulas/:aulaId/convalidaciones', docenteController.listarConvalidaciones);
router.put('/convalidaciones/:certificadoId/evaluar', docenteController.evaluarConvalidacion);

// 5. Revision de formulario FCP-001A
router.get('/aulas/:aulaId/formulario-pendiente', docenteController.obtenerFormularioPendiente);

// 6. Cierre formal, calificacion y emision de acta FCP-004
router.post('/aulas/:aulaId/cerrar-practica', docenteController.cerrarPractica);

export default router;
