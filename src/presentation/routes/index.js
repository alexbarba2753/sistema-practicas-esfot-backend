import { Router } from 'express';
import authRoutes from './authRoutes.js';
import adminRoutes from './adminRoutes.js';
import estudianteRoutes from './estudianteRoutes.js';
import docenteRoutes from './docenteRoutes.js';

const router = Router();

// Rutas de autenticacion y perfil
router.use('/auth', authRoutes);

// Rutas del rol Administrador
router.use('/admin', adminRoutes);

// Rutas del rol Estudiante
router.use('/estudiante', estudianteRoutes);

// Rutas del rol Docente Tutor
router.use('/docente', docenteRoutes);

export default router;
