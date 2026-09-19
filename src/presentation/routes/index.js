import { Router } from 'express';
import authRoutes from './authRoutes.js';

const router = Router();

// Rutas de autenticacion y perfil
router.use('/auth', authRoutes);

export default router;
