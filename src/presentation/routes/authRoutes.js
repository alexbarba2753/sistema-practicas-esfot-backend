import { Router } from 'express';
import { authController } from '../controllers/authController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = Router();

// Rutas publicas
router.post('/login', authController.login);

// Rutas protegidas
router.get('/perfil', authMiddleware, authController.miPerfil);

export default router;
