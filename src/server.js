import app from './app.js';
import { ENV } from './infrastructure/config/env.js';
import { connectDB } from './infrastructure/database/db.js';

const startServer = async () => {
  await connectDB();

  app.listen(ENV.PORT, () => {
    console.log(`[Servidor] Escuchando en http://localhost:${ENV.PORT}`);
    console.log(`[Entorno] Modo: ${ENV.NODE_ENV}`);
  });
};

startServer();
