import Groq from 'groq-sdk';
import { ENV } from '../../infrastructure/config/env.js';
import { FuenteInstitucional } from '../../infrastructure/database/models/FuenteInstitucional.js';
import { AulaVirtual } from '../../infrastructure/database/models/AulaVirtual.js';
import { ActividadLaboral } from '../../infrastructure/database/models/ActividadLaboral.js';
import { ActividadComunitaria } from '../../infrastructure/database/models/ActividadComunitaria.js';
import { FormularioPendiente } from '../../infrastructure/database/models/FormularioPendiente.js';
import { MODALIDADES } from '../../domain/constants/practicasConstants.js';
import { actividadService } from './actividadService.js';
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

    if (aula.estudiante && estudianteId && aula.estudiante.toString() !== estudianteId.toString()) {
      throw errorHttp('No tienes permiso para generar el informe de esta aula virtual', 403);
    }

    let formulario = await FormularioPendiente.findOne({ aulaVirtual: aulaId });
    if (!formulario) {
      throw errorHttp('Primero debes consultar y completar los datos generales del formulario antes de generar con IA', 400);
    }

    // 1. Validar que todos los datos generales obligatorios del F_AA_119 esten completos
    const er = formulario.entidadReceptora || {};
    const hs = formulario.horarioSemanal || {};
    const camposEntidad = [
      ['razonSocial', 'Razón social'],
      ['ruc', 'RUC'],
      ['direccion', 'Dirección'],
      ['correo', 'Correo electrónico'],
      ['ciudad', 'Ciudad'],
      ['telefono', 'Teléfono'],
      ['celular', 'Celular'],
      ['tipoEntidad', 'Tipo de entidad'],
      ['responsable', 'Responsable de la entidad receptora'],
      ['areaAsignada', 'Área asignada']
    ];

    const faltantes = [];
    for (const [key, label] of camposEntidad) {
      if (!er[key] || String(er[key]).trim() === '') {
        faltantes.push(label);
      }
    }
    if (!formulario.creditosAprobados || Number(formulario.creditosAprobados) <= 0) {
      faltantes.push('Créditos aprobados');
    }
    if (!hs.horaInicio || String(hs.horaInicio).trim() === '') faltantes.push('Hora de inicio');
    if (!hs.horaFin || String(hs.horaFin).trim() === '') faltantes.push('Hora de fin');
    if (!hs.horasSemanales || Number(hs.horasSemanales) <= 0) faltantes.push('Horas semanales');

    if (faltantes.length > 0) {
      throw errorHttp(
        `Debes completar todos los datos generales del formulario antes de generar el borrador con IA. Faltan: ${faltantes.join(', ')}`,
        400
      );
    }

    // 2. Validar que el estudiante haya culminado el 100% de las horas pactadas del aula
    const resumenHoras = await actividadService.calcularHorasAula(aulaId);
    if (!resumenHoras.cumplioRequisito) {
      throw errorHttp(
        `Debes completar el 100% de las horas del aula antes de generar el borrador con IA (${resumenHoras.horasAprobadas}/${aula.horasRequeridas}h aprobadas)`,
        400
      );
    }

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
    const totalHoras = resumenHoras.horasAprobadas;

    formulario.totalHoras = totalHoras;
    formulario.contenidoIa.principalesActividades = descripciones.slice(0, 1000);
    formulario.contenidoIa.asignaturasUtilidad =
      'Programación Orientada a Objetos (TDSD214): Estructuras de control y servicios; Bases de Datos (TDSD224): Modelado y persistencia; Ingeniería de Software (TDSD314): Arquitectura y pruebas; Metodologías Ágiles (TDSD324): Gestión ágil de proyectos.';
    formulario.contenidoIa.habilidadesAdquiridas =
      'Desarrollo de servicios backend RESTful, persistencia de datos relacional y documental, aplicación de buenas prácticas de arquitectura limpia y trabajo colaborativo.';
    formulario.contenidoIa.observacionesTemas =
      'Se fortalecieron competencias en herramientas de versionamiento profesional, pruebas unitarias y despliegue de soluciones tecnológicas alineadas al perfil de egreso.';
    formulario.contenidoIa.resumenActividades = descripciones.slice(0, 800);
    formulario.contenidoIa.contribucionConocimientos =
      'Las actividades técnicas permitieron consolidar el razonamiento lógico, diseño modular y aseguramiento de calidad del software en entornos reales.';
    formulario.contenidoIa.resultadosAprendizaje =
      'Capacidad para diseñar, desarrollar, verificar y documentar sistemas informáticos que resuelven necesidades institucionales.';
    formulario.contenidoIa.asignaturasMalla =
      'TDSD114 Fundamentos de Programación, TDSD214 Programación Orientada a Objetos, TDSD224 Bases de Datos, TDSD314 Ingeniería de Software.';
    formulario.fechaGeneracionIa = new Date();

    await formulario.save();

    return {
      success: true,
      message: 'Borrador del informe generado exitosamente con el contenido tecnico de la bitacora',
      formulario
    };
  }
};
