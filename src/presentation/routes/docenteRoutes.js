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

// 2. Evaluacion de bitacora laboral
router.get('/aulas/:aulaId/laborales', docenteController.listarActividadesLaborales);
router.put('/actividades/laborales/:actividadId/evaluar', docenteController.evaluarActividadLaboral);

// 3. Evaluacion de bitacora comunitaria
router.get('/aulas/:aulaId/comunitarias', docenteController.listarActividadesComunitarias);
router.put('/actividades/comunitarias/:actividadId/evaluar', docenteController.evaluarActividadComunitaria);

// 4. Revision y evaluacion de seguimiento del formulario F_AA_119 / FCP-001A
router.get('/aulas/:aulaId/formulario-pendiente', docenteController.obtenerFormularioPendiente);
router.put('/aulas/:aulaId/formulario-pendiente', docenteController.actualizarFormularioPendiente);
router.put('/aulas/:aulaId/evaluar-formulario', docenteController.evaluarSeguimientoDocente);
router.get('/aulas/:aulaId/descargar-informe', docenteController.descargarInforme);

// 6. Dictamen del docente tutor (aprobar o devolver con observaciones)
router.post('/aulas/:aulaId/cerrar-practica', docenteController.cerrarPractica);

export default router;
