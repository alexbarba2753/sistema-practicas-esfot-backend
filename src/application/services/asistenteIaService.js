import Groq from 'groq-sdk';
import { ENV } from '../../infrastructure/config/env.js';
import { FuenteInstitucional } from '../../infrastructure/database/models/FuenteInstitucional.js';
import { AulaVirtual } from '../../infrastructure/database/models/AulaVirtual.js';
import { AulaConvalidacion } from '../../infrastructure/database/models/AulaConvalidacion.js';
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

const normalizarTexto = (txt = '') =>
  String(txt)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const ES_MATERIA_TITULACION = (texto = '') => {
  const norm = normalizarTexto(texto);
  return (
    norm.includes('integracion curricular') ||
    norm.includes('examen complexivo') ||
    norm.includes('caracter complexivo') ||
    /\btitd\d+/i.test(texto)
  );
};

async function obtenerContextoMallaCurricular(carrera = '') {
  let fuentes = [];
  try {
    fuentes = await FuenteInstitucional.find({ activo: true });
  } catch {
    return { contextoMalla: '' };
  }

  if (!Array.isArray(fuentes) || fuentes.length === 0) {
    return { contextoMalla: '' };
  }

  const carreraNorm = normalizarTexto(carrera);
  const palabrasCarrera = carreraNorm.split(/\s+/).filter((w) => w.length >= 4);

  const fuenteMalla =
    fuentes.find((f) => {
      const tituloNorm = normalizarTexto(f.titulo);
      return /malla|pensum|curricular/.test(tituloNorm) &&
        (palabrasCarrera.length === 0 || palabrasCarrera.some((p) => tituloNorm.includes(p)));
    }) ||
    fuentes.find((f) => /malla|pensum|curricular/i.test(f.titulo || ''));

  if (!fuenteMalla || !Array.isArray(fuenteMalla.fragmentos)) {
    return { contextoMalla: '' };
  }

  const fragmentosConMaterias = fuenteMalla.fragmentos
    .map((fr) => fr.texto || '')
    .filter((t) => /c[oó]digo:/i.test(t))
    .map((t) =>
      t
        .split('\n')
        .filter((linea) => !ES_MATERIA_TITULACION(linea))
        .join('\n')
    )
    .filter(Boolean);

  const contextoMalla = fragmentosConMaterias.join('\n').slice(0, 15000);

  return {
    tituloFuente: fuenteMalla.titulo,
    contextoMalla
  };
}

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
          model: ENV.GROQ_MODEL || 'openai/gpt-oss-120b',
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
          temperature: 0.3,
          max_completion_tokens: 2048,
          top_p: 1,
          reasoning_effort: 'medium',
          stream: false
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

    if (aula.expedienteEntregado && formulario.estado !== 'observado') {
      throw errorHttp('El expediente ya fue entregado a revision; no puedes regenerar el borrador hasta que el docente lo devuelva', 403);
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
    if (!hs.horasSemanales || Number(hs.horasSemanales) <= 0) {
      faltantes.push('Horario semanal configurado');
    }

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
      const registro = await ActividadLaboral.findOne({ aulaVirtual: aulaId });
      actividades = [...(registro?.actividades || [])].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    } else {
      actividades = await ActividadComunitaria.find({ aulaVirtual: aulaId }).sort({ fecha: 1 });
    }

    if (actividades.length === 0) {
      throw errorHttp('No existen actividades registradas en la bitacora para generar el informe', 400);
    }

    const totalHoras = resumenHoras.horasAprobadas;
    formulario.totalHoras = totalHoras;

    const descripcionesUnicas = [...new Set(actividades.map((a) => (a.descripcion || '').trim()).filter(Boolean))];
    const bitacoraTexto = actividades
      .map((a, idx) => `${idx + 1}. (${a.horas}h) ${a.descripcion}`)
      .join('\n');

    if (aula.modalidad === MODALIDADES.LABORAL) {
      const { contextoMalla } = await obtenerContextoMallaCurricular(
        aula.carrera || 'Desarrollo de Software'
      );

      const client = getGroqClient();
      if (!client) {
        throw errorHttp('El servicio de IA (Groq) no está configurado. Verifica GROQ_API_KEY.', 503);
      }

      let generado = null;
      try {
        const completion = await client.chat.completions.create({
          model: ENV.GROQ_MODEL || 'openai/gpt-oss-120b',
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                'Eres un redactor académico técnico de la ESFOT (Escuela Politécnica Nacional). Devuelves EXCLUSIVAMENTE un objeto JSON válido con las claves exactas: "asignaturasUtilidad", "principalesActividades", "habilidadesAdquiridas", "observacionesTemas". Redactas en español formal académico, sintetizando y enriqueciendo técnicamente el contenido sin copiar literalmente las entradas de la bitácora, y usando únicamente asignaturas reales de la malla provista.'
            },
            {
              role: 'user',
              content: `Carrera: ${aula.carrera || 'Desarrollo de Software'}
Área asignada: ${er.areaAsignada || 'Desarrollo de Software'}
Total de horas cumplidas: ${totalHoras}h

Malla Curricular oficial (Fuente RAG):
${contextoMalla || 'No disponible'}

Bitácora completa de actividades registradas por el estudiante:
${bitacoraTexto.slice(0, 8000)}

Genera el JSON siguiendo estas reglas estrictas:
1. "asignaturasUtilidad": Analiza TODAS las actividades de la bitácora y selecciona de la Malla Curricular oficial provista todas las asignaturas profesionales pertinentes a lo ejecutado (idealmente entre 4 y 8 asignaturas si las actividades abarcan distintas áreas; no te limites a 2).
   - PROHIBIDO incluir asignaturas de titulación o examen complexivo (como "Diseño de Trabajo de Integración Curricular", "Preparación Examen Complexivo", "Trabajo de Integración Curricular" o "Examen de Carácter Complexivo").
   - Para CADA asignatura elegida, deduce y redacta los temas o contenidos específicos de esa materia que se aplicaron en las actividades (ejemplo: "• Bases de Datos (TDSD343): Diseño de esquemas relacionales y no relacionales, consultas, indexación e integridad de datos"). PROHIBIDO usar frases genéricas o repetitivas como "Aplicación práctica de sus fundamentos en el proyecto".
   - Formato OBLIGATORIO: UNA POR LÍNEA empezando cada línea con "• Nombre exacto (CÓDIGO): Temáticas específicas aplicadas".
2. "principalesActividades": Sintetiza y agrupa todas las actividades de la bitácora en un resumen técnico enriquecido (NO copies ni parafrasees línea por línea cada registro de la bitácora). Redacta entre 5 y 7 viñetas elaboradas que expliquen con claridad el alcance técnico, arquitectura, módulos y propósito de lo desarrollado. Formato OBLIGATORIO: UNA POR LÍNEA empezando cada línea con "• ".
3. "habilidadesAdquiridas": Redacta un texto técnico amplio y detallado (120 a 180 palabras, equivalente a 6 a 9 líneas) sobre las competencias técnicas, metodologías, herramientas y habilidades profesionales consolidadas durante la práctica, sustentado en las actividades reales de la bitácora.
4. "observacionesTemas": Redacta un párrafo amplio y específico (90 a 140 palabras, equivalente a 4 a 7 líneas) detallando las herramientas, frameworks, estándares o temáticas avanzadas que no se profundizaron en clases y que el estudiante debió investigar y aplicar de forma autónoma durante la práctica.`
            }
          ],
          temperature: 0.4,
          max_completion_tokens: 4096,
          top_p: 1,
          reasoning_effort: 'medium',
          stream: false
        });

        const rawJson = completion.choices[0]?.message?.content;
        if (!rawJson) {
          throw new Error('La respuesta del modelo llegó vacía');
        }
        const limpioJson = rawJson.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
        generado = JSON.parse(limpioJson);
      } catch (err) {
        console.error('Error al generar informe con Groq:', err.message);
        throw errorHttp(`No se pudo generar el informe con IA (Groq): ${err.message}`, 502);
      }

      const asignaturasFiltradas = String(generado?.asignaturasUtilidad || '')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !ES_MATERIA_TITULACION(l))
        .join('\n');

      const principalesActividades = String(generado?.principalesActividades || '').trim();
      const habilidadesAdquiridas = String(generado?.habilidadesAdquiridas || '').trim();
      const observacionesTemas = String(generado?.observacionesTemas || '').trim();

      if (!asignaturasFiltradas || !principalesActividades || !habilidadesAdquiridas || !observacionesTemas) {
        throw errorHttp(
          'La IA devolvió campos vacíos o incompletos al generar el informe. Intenta nuevamente.',
          502
        );
      }

      formulario.contenidoIa.asignaturasUtilidad = asignaturasFiltradas;
      formulario.contenidoIa.principalesActividades = principalesActividades;
      formulario.contenidoIa.habilidadesAdquiridas = habilidadesAdquiridas;
      formulario.contenidoIa.observacionesTemas = observacionesTemas;
      formulario.fechaGeneracionIa = new Date();

      await formulario.save();

      const objForm = typeof formulario.toObject === 'function' ? formulario.toObject() : { ...formulario };
      objForm.contenidoIa = {
        asignaturasUtilidad: formulario.contenidoIa.asignaturasUtilidad,
        principalesActividades: formulario.contenidoIa.principalesActividades,
        habilidadesAdquiridas: formulario.contenidoIa.habilidadesAdquiridas,
        observacionesTemas: formulario.contenidoIa.observacionesTemas
      };

      return {
        success: true,
        message: 'Borrador del informe generado exitosamente con IA a partir de la bitácora',
        formulario: objForm
      };
    }

    const descripciones = descripcionesUnicas.join('. ');
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
  },

  // Mejora y amplia con IA la Seccion 6 del formulario FCP-001A de convalidacion usando el borrador y el certificado PDF
  async mejorarFormularioConvalidacionIA(aulaId, estudianteId) {
    const aula = await AulaConvalidacion.findById(aulaId);
    if (!aula) throw errorHttp('Aula de convalidacion no encontrada', 404);

    if (aula.estudiante && estudianteId && aula.estudiante.toString() !== estudianteId.toString()) {
      throw errorHttp('No tienes permiso para mejorar el formulario de esta aula de convalidacion', 403);
    }

    const formulario = await FormularioPendiente.findOne({ aulaVirtual: aulaId });
    if (!formulario) {
      throw errorHttp('No se encontro el formulario pendiente de esta aula de convalidacion', 404);
    }

    if (aula.expedienteEntregado && formulario.estado !== 'observado') {
      throw errorHttp('El expediente ya fue entregado a revision; no puedes modificarlo hasta que el docente lo devuelva', 403);
    }

    const ci = formulario.contenidoIa || {};
    const resumenOriginal = ci.resumenActividades || '';
    const contribucionOriginal = ci.contribucionConocimientos || '';
    const resultadosOriginal = ci.resultadosAprendizaje || '';
    const asignaturasOriginal = ci.asignaturasMalla || '';

    if (!resumenOriginal && !contribucionOriginal && !resultadosOriginal && !asignaturasOriginal) {
      throw errorHttp('El formulario no contiene informacion en la Seccion 6 para mejorar', 400);
    }

    const textoCertificado = aula.certificadoPdf?.textoExtraido || '';
    const { contextoMalla } = await obtenerContextoMallaCurricular(
      aula.carrera || 'Desarrollo de Software'
    );

    const client = getGroqClient();
    if (!client) {
      throw errorHttp('El servicio de IA (Groq) no está configurado. Verifica GROQ_API_KEY.', 503);
    }

    let mejorado = null;
    try {
      const completion = await client.chat.completions.create({
        model: ENV.GROQ_MODEL || 'openai/gpt-oss-120b',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Eres un asesor académico oficial de la ESFOT (Escuela Politécnica Nacional). Tu tarea es corregir cualquier falta ortográfica, gramatical o de concordancia del borrador del estudiante y transformar la Sección 6 del formulario FCP-001A en una redacción técnica, formal, amplia y bien estructurada en español académico, integrando lo escrito por el estudiante, la información real del certificado PDF y la malla curricular oficial. Devuelve EXCLUSIVAMENTE un objeto JSON válido con las claves exactas: "resumenActividades", "contribucionConocimientos", "resultadosAprendizaje", "asignaturasMalla". No inventes instituciones, horas ni fechas distintas a las provistas.'
          },
          {
            role: 'user',
            content: `Carrera: ${aula.carrera || 'Desarrollo de Software'}
Modalidad de convalidación: ${aula.modalidad}
Horas solicitadas: ${aula.horasRequeridas}h
Institución / Plataforma: ${aula.datosInstitucion?.razonSocial || formulario.entidadReceptora?.razonSocial || 'N/A'}

Texto extraído del certificado PDF:
${textoCertificado.slice(0, 4000) || 'No disponible'}

Campos actuales de la Sección 6 ingresados por el estudiante (pueden contener errores ortográficos o redacción básica):
- Breve resumen de actividades realizadas: ${resumenOriginal}
- Contribución al perfil de egreso: ${contribucionOriginal}
- Resultados de aprendizaje del perfil de egreso: ${resultadosOriginal}
- Asignaturas de la malla curricular y temáticas: ${asignaturasOriginal}

Malla Curricular oficial (Fuente RAG):
${contextoMalla || 'No disponible'}

Instrucciones estrictas para el JSON:
1. "resumenActividades": Corrige errores y amplía sustancialmente (130 a 200 palabras) combinando un breve párrafo introductorio de contexto con 4 a 6 viñetas detalladas empezando con "• " que expliquen con rigor técnico/operativo cada actividad realizada según el borrador y el certificado PDF (sin copiar textualmente).
2. "contribucionConocimientos": Corrige errores y redacta una explicación amplia, argumentada y formal (110 a 160 palabras) sobre cómo estas actividades fortalecieron el perfil de egreso de la carrera, vinculando la experiencia práctica con competencias técnicas, organizacionales y de trabajo colaborativo.
3. "resultadosAprendizaje": Corrige errores y desarrolla un texto amplio y estructurado (100 a 150 palabras), combinando un párrafo inicial con 3 o 4 viñetas ("• ") que detallen los resultados de aprendizaje específicos del perfil de egreso alcanzados o reforzados.
4. "asignaturasMalla": Lee las actividades y el borrador del estudiante, y selecciona entre 4 y 6 asignaturas reales de la Malla Curricular oficial provista (con su nombre y código exactos entre paréntesis). Para cada asignatura explica las temáticas concretas aplicadas durante la actividad. Formato OBLIGATORIO: UNA POR LÍNEA empezando cada línea con "• Nombre exacto (CÓDIGO): Temáticas específicas aplicadas". PROHIBIDO incluir asignaturas de Trabajo de Integración Curricular o Examen Complexivo.`
          }
        ],
        temperature: 0.4,
        max_completion_tokens: 4096,
        top_p: 1,
        reasoning_effort: 'medium',
        stream: false
      });

      const rawJson = completion.choices[0]?.message?.content;
      if (!rawJson) {
        throw new Error('La respuesta del modelo llegó vacía');
      }
      const limpioJson = rawJson.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      mejorado = JSON.parse(limpioJson);
    } catch (err) {
      console.error('Error al mejorar formulario de convalidacion con Groq:', err.message);
      throw errorHttp(`No se pudo mejorar el formulario con IA (Groq): ${err.message}`, 502);
    }

    const asignaturasFiltradas = String(mejorado?.asignaturasMalla || '')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !ES_MATERIA_TITULACION(l))
      .join('\n');

    const resumenActividades = String(mejorado?.resumenActividades || '').trim();
    const contribucionConocimientos = String(mejorado?.contribucionConocimientos || '').trim();
    const resultadosAprendizaje = String(mejorado?.resultadosAprendizaje || '').trim();

    if (!resumenActividades || !contribucionConocimientos || !resultadosAprendizaje || !asignaturasFiltradas) {
      throw errorHttp(
        'La IA devolvió campos vacíos o incompletos al mejorar la Sección 6. Intenta nuevamente.',
        502
      );
    }

    formulario.contenidoIa.resumenActividades = resumenActividades;
    formulario.contenidoIa.contribucionConocimientos = contribucionConocimientos;
    formulario.contenidoIa.resultadosAprendizaje = resultadosAprendizaje;
    formulario.contenidoIa.asignaturasMalla = asignaturasFiltradas;
    formulario.fechaGeneracionIa = new Date();

    await formulario.save();

    return {
      success: true,
      message: 'Seccion 6 del formulario FCP-001A mejorada y ampliada exitosamente con IA a partir del borrador y certificado',
      formulario
    };
  }
};
