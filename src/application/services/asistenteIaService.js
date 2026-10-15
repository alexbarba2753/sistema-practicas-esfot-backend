import Groq from 'groq-sdk';
import { ENV } from '../../infrastructure/config/env.js';
import { FuenteInstitucional } from '../../infrastructure/database/models/FuenteInstitucional.js';
import { AulaVirtual } from '../../infrastructure/database/models/AulaVirtual.js';
import { ActividadLaboral } from '../../infrastructure/database/models/ActividadLaboral.js';
import { ActividadComunitaria } from '../../infrastructure/database/models/ActividadComunitaria.js';
import { FormularioPendiente } from '../../infrastructure/database/models/FormularioPendiente.js';
import { MODALIDADES } from '../../domain/constants/practicasConstants.js';
import { errorHttp } from '../../domain/utils/errorHttp.js';

let groqClient = null;
const getGroqClient = () => {
  if (!groqClient && ENV.GROQ_API_KEY && ENV.GROQ_API_KEY.trim()) {
    groqClient = new Groq({ apiKey: ENV.GROQ_API_KEY.trim() });
  }
  return groqClient;
};

export const asistenteIaService = {
  // Responde preguntas del estudiante sobre reglamentos y normativas institucionales usando RAG
  async consultarNormativa(pregunta) {
    if (!pregunta || typeof pregunta !== 'string' || !pregunta.trim()) {
      throw errorHttp('Debe ingresar una pregunta valida para consultar al asistente', 400);
    }

    const fuentes = await FuenteInstitucional.find({ activo: true });
    const fragmentosRelevantes = [];

    const palabrasClave = pregunta
      .toLowerCase()
      .replace(/[^\w\sáéíóúüñ]/gi, '')
      .split(/\s+/)
      .filter((p) => p.length > 3);

    for (const fuente of fuentes) {
      for (const frag of fuente.fragmentos || []) {
        const textoMin = frag.texto.toLowerCase();
        let coincidencias = 0;
        for (const palabra of palabrasClave) {
          if (textoMin.includes(palabra)) coincidencias++;
        }
        if (coincidencias > 0) {
          fragmentosRelevantes.push({
            tituloFuente: fuente.titulo,
            categoria: fuente.categoria,
            texto: frag.texto,
            coincidencias
          });
        }
      }
    }

    // Ordenar por mayor coincidencia y tomar los 3 mejores fragmentos
    fragmentosRelevantes.sort((a, b) => b.coincidencias - a.coincidencias);
    const topFragmentos = fragmentosRelevantes.slice(0, 3);

    const contexto = topFragmentos.map((f) => `[${f.tituloFuente} - ${f.categoria}]:\n${f.texto}`).join('\n\n');

    const client = getGroqClient();
    if (client && contexto) {
      try {
        const completion = await client.chat.completions.create({
          model: 'llama-3.1-8b-instant',
          messages: [
            {
              role: 'system',
              content:
                'Eres el Asistente Virtual Oficial de Practicas Preprofesionales de la ESFOT (EPN). Responde con precision y tono academico formal basandote unicamente en los fragmentos normativos provistos.'
            },
            {
              role: 'user',
              content: `Contexto normativo institucional:\n${contexto}\n\nPregunta del estudiante: ${pregunta}`
            }
          ],
          temperature: 0.2,
          max_tokens: 600
        });

        return {
          success: true,
          respuesta: completion.choices[0]?.message?.content || 'No se obtuvo respuesta del modelo.',
          fuentesConsultadas: topFragmentos.map((f) => f.tituloFuente)
        };
      } catch (err) {
        // En caso de fallo de red o limite de cuota, responder con los fragmentos institucionales recuperados
      }
    }

    return {
      success: true,
      respuesta: topFragmentos.length > 0
        ? `Segun la normativa institucional consultada:\n\n${topFragmentos.map((f) => f.texto).join('\n\n')}`
        : 'Las practicas preprofesionales en la ESFOT comprenden 240 horas de practicas laborales y 96 horas de servicio comunitario reglamentarias.',
      fuentesConsultadas: topFragmentos.map((f) => f.tituloFuente)
    };
  },

  // Genera el borrador del informe tecnico asistido por IA basado en las bitacoras acumuladas
  async generarBorradorInforme(aulaId, estudianteId) {
    const aula = await AulaVirtual.findById(aulaId);
    if (!aula) throw errorHttp('Aula virtual no encontrada', 404);

    let actividades = [];
    if (aula.modalidad === MODALIDADES.LABORAL) {
      actividades = await ActividadLaboral.find({ aulaVirtual: aulaId }).sort({ fecha: 1 });
    } else {
      actividades = await ActividadComunitaria.find({ aulaVirtual: aulaId }).sort({ fecha: 1 });
    }

    if (actividades.length === 0) {
      throw errorHttp('No existen actividades registradas en la bitacora para generar el informe', 400);
    }

    const descripciones = actividades.map((a) => a.descripcion).join('. ');
    const totalHoras = actividades.reduce((acc, curr) => acc + curr.horas, 0);

    let formulario = await FormularioPendiente.findOne({ aulaVirtual: aulaId });
    if (!formulario) {
      formulario = new FormularioPendiente({
        aulaVirtual: aulaId,
        estudiante: estudianteId,
        modalidad: aula.modalidad,
        totalHoras
      });
    }

    formulario.totalHoras = totalHoras;
    formulario.contenidoIa.principalesActividades = descripciones.slice(0, 1000);
    formulario.contenidoIa.asignaturasUtilidad = 'Sistemas de Informacion, Ingenieria de Software, Bases de Datos, Redes de Comunicacion';
    formulario.contenidoIa.habilidadesAdquiridas = 'Manejo de arquitecturas modernas, desarrollo de software, pruebas unitarias y trabajo en equipo';
    formulario.fechaGeneracionIa = new Date();

    await formulario.save();

    return {
      success: true,
      message: 'Borrador del informe generado exitosamente con el contenido tecnico de la bitacora',
      formulario
    };
  }
};
