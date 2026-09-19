import express from 'express';
import cors from 'cors';
import routes from './presentation/routes/index.js';
import { errorHandler } from './presentation/middlewares/errorHandler.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Comprobacion de salud
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'API Sistema de Prácticas ESFOT operativa',
    timestamp: new Date().toISOString()
  });
});

// Rutas de la API
app.use('/api', routes);

app.use(errorHandler);

export default app;
