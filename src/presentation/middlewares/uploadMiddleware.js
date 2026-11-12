import multer from 'multer';
import { errorHttp } from '../../domain/utils/errorHttp.js';

const storage = multer.memoryStorage();

export const uploadDocumento = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024 // 20 MB
  }
});

// Middleware para procesar archivos normativos (markdown) por multipart/form-data o json
export const procesarArchivoNormativo = async (req, res, next) => {
  try {
    const contentType = req.headers['content-type'] || '';

    // Si la peticion viene como json
    if (contentType.includes('application/json')) {
      req.body = { ...req.query, ...req.body };
      return next();
    }

    if (!contentType.includes('multipart/form-data')) {
      throw errorHttp('Debe enviar los datos en formato multipart/form-data o application/json', 400);
    }

    const boundaryMatch = contentType.match(/boundary=([^;]+)/);
    if (!boundaryMatch) {
      throw errorHttp('Formato de formulario multipart no valido', 400);
    }

    const boundary = boundaryMatch[1].trim().replace(/^["']|["']$/g, '');
    const chunks = [];

    for await (const chunk of req) {
      chunks.push(chunk);
    }

    const buffer = Buffer.concat(chunks);
    const parts = buffer.toString('utf-8').split('--' + boundary);

    req.body = { ...req.query };

    for (const part of parts) {
      if (!part || part.trim() === '' || part.trim() === '--') continue;
      const headerEnd = part.indexOf('\r\n\r\n');
      if (headerEnd === -1) continue;

      const headers = part.slice(0, headerEnd);
      const content = part.slice(headerEnd + 4).replace(/\r\n$/, '');
      const filenameMatch = headers.match(/filename="([^"]+)"/);

      if (filenameMatch) {
        req.body.contenido = content.trim();
        req.body.nombreArchivo = filenameMatch[1];
      } else {
        const nameMatch = headers.match(/name="([^"]+)"/);
        if (nameMatch) {
          req.body[nameMatch[1]] = content.trim();
        }
      }
    }

    if (!req.body.contenido) {
      throw errorHttp('No se encontro el contenido del archivo o texto normativo', 400);
    }

    next();
  } catch (error) {
    next(error);
  }
};
