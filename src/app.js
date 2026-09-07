import express from 'express';
import cors from 'cors';
import { errorHandler } from './presentation/middlewares/errorHandler.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ruta base para comprobacion de estado
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'API Sistema de Prácticas ESFOT operativa',
    timestamp: new Date().toISOString()
  });
});

app.use(errorHandler);

export default app;
