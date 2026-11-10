import { FuenteInstitucional } from '../../infrastructure/database/models/FuenteInstitucional.js';
import { dividirEnFragmentos } from '../../domain/utils/textChunker.js';
import { errorHttp } from '../../domain/utils/errorHttp.js';

const CATEGORIAS_VALIDAS = ['reglamento', 'instructivo', 'formato', 'resolucion', 'general'];

export const fuenteService = {
  // Procesa e indexa un documento normativo institucional para el asistente de IA
  async ingestarFuente(datos, usuarioId) {
    let { titulo, categoria, descripcion, contenido, enlaceUrl, version, nombreArchivo } = datos;

    if (!contenido) {
      throw errorHttp('El contenido del documento normativo es obligatorio', 400);
    }

    // Si no se envio titulo, extraer la primera linea con # o usar nombre del archivo
    if (!titulo || (typeof titulo === 'string' && !titulo.trim())) {
      const lineaH1 = contenido.split('\n').find((l) => l.startsWith('# '));
      titulo = lineaH1 ? lineaH1.replace(/^#\s+/, '').trim() : (nombreArchivo || 'Documento Normativo Institucional');
    }

    if (!descripcion || (typeof descripcion === 'string' && !descripcion.trim())) {
      descripcion = `Documento normativo institucional (${categoria || 'reglamento'})`;
    }

    if (categoria && !CATEGORIAS_VALIDAS.includes(categoria)) {
      throw errorHttp(`Categoria no valida. Permitidas: ${CATEGORIAS_VALIDAS.join(', ')}`, 400);
    }

    const fragmentos = dividirEnFragmentos(contenido);

    const nuevaFuente = new FuenteInstitucional({
      titulo: titulo.trim(),
      categoria: categoria || 'reglamento',
      descripcion: descripcion.trim(),
      contenido: contenido.trim(),
      fragmentos,
      enlaceUrl: enlaceUrl ? enlaceUrl.trim() : '',
      version: version ? version.trim() : '1.0',
      activo: true,
      subidoPor: usuarioId
    });

    await nuevaFuente.save();
    return nuevaFuente;
  },

  async listarFuentes(filtros = {}) {
    const query = {};

    if (filtros.categoria && CATEGORIAS_VALIDAS.includes(filtros.categoria)) {
      query.categoria = filtros.categoria;
    }

    if (filtros.activo !== undefined) {
      query.activo = filtros.activo === 'true' || filtros.activo === true;
    }

    if (filtros.busqueda) {
      const regex = new RegExp(filtros.busqueda.trim(), 'i');
      query.$or = [{ titulo: regex }, { descripcion: regex }];
    }

    return await FuenteInstitucional.find(query)
      .select('-contenido -fragmentos')
      .populate('subidoPor', 'nombres apellidos correo')
      .sort({ createdAt: -1 });
  },

  async obtenerFuentePorId(id) {
    const fuente = await FuenteInstitucional.findById(id).populate('subidoPor', 'nombres apellidos correo');
    if (!fuente) {
      throw errorHttp('Documento o fuente no encontrada', 404);
    }
    return fuente;
  },

  async actualizarFuente(id, datos) {
    const fuente = await FuenteInstitucional.findById(id);
    if (!fuente) throw errorHttp('Documento o fuente no encontrada', 404);

    if (datos.titulo) fuente.titulo = datos.titulo.trim();
    if (datos.descripcion) fuente.descripcion = datos.descripcion.trim();
    if (datos.enlaceUrl !== undefined) fuente.enlaceUrl = datos.enlaceUrl.trim();
    if (datos.version) fuente.version = datos.version.trim();

    if (datos.categoria) {
      if (!CATEGORIAS_VALIDAS.includes(datos.categoria)) {
        throw errorHttp(`Categoria no valida. Permitidas: ${CATEGORIAS_VALIDAS.join(', ')}`, 400);
      }
      fuente.categoria = datos.categoria;
    }

    if (datos.contenido) {
      fuente.contenido = datos.contenido.trim();
      fuente.fragmentos = dividirEnFragmentos(fuente.contenido);
    }

    await fuente.save();
    return fuente;
  },

  async cambiarEstadoFuente(id, activo) {
    const fuente = await FuenteInstitucional.findById(id);
    if (!fuente) throw errorHttp('Documento o fuente no encontrada', 404);

    fuente.activo = Boolean(activo);
    await fuente.save();
    return fuente;
  }
};
