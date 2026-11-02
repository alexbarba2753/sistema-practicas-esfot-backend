import { Router } from 'express';
import { estudianteController } from '../controllers/estudianteController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/roleMiddleware.js';
import { ROLES } from '../../domain/constants/practicasConstants.js';

const router = Router();

// Todas las rutas de estudiante requieren sesion activa y rol Estudiante
router.use(authMiddleware, requireRole(ROLES.ESTUDIANTE));

// 1. Aulas y progreso en vivo
router.get('/aulas', estudianteController.obtenerAulas);

// 2. Chatbot RAG de consultas normativas
router.post('/ia/consulta', estudianteController.consultarAsistenteIa);

// 3. Bitacora laboral FCP-002
router.post('/aulas/:aulaId/laborales', estudianteController.crearActividadLaboral);
router.get('/aulas/:aulaId/laborales', estudianteController.listarActividadesLaborales);

// 4. Bitacora comunitaria FCP-002
router.post('/aulas/:aulaId/comunitarias', estudianteController.crearActividadComunitaria);
router.get('/aulas/:aulaId/comunitarias', estudianteController.listarActividadesComunitarias);

// 5. Convalidacion de certificaciones externas
router.post('/aulas/:aulaId/convalidaciones', estudianteController.registrarCertificado);
router.get('/aulas/:aulaId/convalidaciones', estudianteController.listarCertificados);

// 6. Formulario FCP-001A y reporte asistido por IA
router.get('/aulas/:aulaId/formulario-pendiente', estudianteController.obtenerFormularioPendiente);
router.put('/aulas/:aulaId/formulario-pendiente', estudianteController.actualizarFormularioPendiente);
router.post('/aulas/:aulaId/ia/generar-informe', estudianteController.generarBorradorInforme);
router.get('/aulas/:aulaId/descargar-informe', estudianteController.descargarInforme);

// 7. Entrega formal del expediente
router.post('/aulas/:aulaId/entregar-expediente', estudianteController.entregarExpediente);

export default router;
