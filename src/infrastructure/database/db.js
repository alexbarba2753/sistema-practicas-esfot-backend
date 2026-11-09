import dns from 'dns';
import mongoose from 'mongoose';
import { ENV } from '../config/env.js';

// Servidores DNS publicos para resolver registros SRV de MongoDB Atlas en Windows
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {
  // Ignora si el entorno no permite modificar servidores dns
}

export const connectDB = async () => {
  try {
    if (!ENV.MONGODB_URI) {
      throw new Error('La variable MONGODB_URI no está configurada');
    }

    const conn = await mongoose.connect(ENV.MONGODB_URI);
    console.log(`[MongoDB] Conectado a: ${conn.connection.host}`);
    console.log(`[MongoDB] Base de datos activa: ${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error('[MongoDB Error]', error.message);
    process.exit(1);
  }
};

export const disconnectDB = async () => {
  await mongoose.disconnect();
};
