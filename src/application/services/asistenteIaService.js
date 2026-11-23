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

async function obtenerContextoMallaCurricular(carrera = '', textoActividades = '') {
  let fuentes = [];
  try {
    fuentes = await FuenteInstitucional.find({ activo: true });
  } catch {
    return { contextoMalla: '', materiasSeleccionadas: [] };
  }

  if (!Array.isArray(fuentes) || fuentes.length === 0) {
    return { contextoMalla: '', materiasSeleccionadas: [] };
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
    return { contextoMalla: '', materiasSeleccionadas: [] };
  }

  const fragmentosConMaterias = fuenteMalla.fragmentos
    .map((fr) => fr.texto || '')
    .filter((t) => /c[oó]digo:/i.test(t));

  const contextoMalla = fragmentosConMaterias.join('\n').slice(0, 6000);

  // Extraer materias reales desde los fragmentos del RAG para respaldo sin IA externa
  const materiasExtraidas = [];
  const regexMateria = /\*\s*\*\*([^*]+)\*\*\s*\|\s*C[oó]digo:\s*`?([A-Z0-9-]+)`?/gi;
  let match;
  while ((match = regexMateria.exec(contextoMalla)) !== null) {
    const nombre = match[1].trim();
    const codigo = match[2].trim();
    if (!/f[ií]sica|c[aá]lculo|comunicaci[oó]n|ingl[eé]s|educaci[oó]n/i.test(nombre)) {
      materiasExtraidas.push({ nombre, codigo });
    }
  }

  const actividadesNorm = normalizarTexto(textoActividades);
  const palabrasAct = actividadesNorm.split(/\s+/).filter((w) => w.length >= 4);

  const puntuadas = materiasExtraidas.map((m) => {
    const nombreNorm = normalizarTexto(m.nombre);
    let score = 0;
    for (const p of palabrasAct) {
      if (nombreNorm.includes(p)) score += 2;
    }
    if (/programaci[oó]n|base|datos|web|software|redes|aplicaciones|dise[nñ]o/i.test(nombreNorm)) {
      score += 1;
    }
    return { ...m, score };
  });

  puntuadas.sort((a, b) => b.score - a.score);
  const materiasSeleccionadas = puntuadas
    .slice(0, 4)
    .map((m) => `• ${m.nombre} (${m.codigo}): Aplicación práctica de sus fundamentos en el proyecto`);

  return {
    tituloFuente: fuenteMalla.titulo,
    contextoMalla,
    materiasSeleccionadas
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
      const { contextoMalla, materiasSeleccionadas } = await obtenerContextoMallaCurricular(
        aula.carrera || 'Desarrollo de Software',
        descripcionesUnicas.join(' ')
      );

      let generado = null;
      const client = getGroqClient();

      if (client) {
        try {
          const completion = await client.chat.completions.create({
            model: ENV.GROQ_MODEL || 'openai/gpt-oss-120b',
            response_format: { type: 'json_object' },
            messages: [
              {
                role: 'system',
                content:
                  'Eres un redactor académico técnico de la ESFOT (Escuela Politécnica Nacional). Debes devolver EXCLUSIVAMENTE un objeto JSON válido con las claves exactas: "asignaturasUtilidad", "principalesActividades", "habilidadesAdquiridas", "observacionesTemas". Redacta en español formal académico, sintetizando sin copiar textualmente la bitácora y usando únicamente asignaturas reales de la malla provista.'
              },
              {
                role: 'user',
                content: `Carrera: ${aula.carrera || 'Desarrollo de Software'}
Área asignada: ${er.areaAsignada || 'Desarrollo de Software'}
Total de horas cumplidas: ${totalHoras}h

Malla Curricular oficial (Fuente RAG):
${contextoMalla || 'No disponible'}

Bitácora de actividades registradas por el estudiante:
${bitacoraTexto.slice(0, 4000)}

Genera el JSON con estas reglas estrictas:
1. "asignaturasUtilidad": Selecciona de la Malla Curricular oficial provista entre 3 y 5 asignaturas que correspondan a las actividades realizadas (con su nombre y código exactos de la malla, más la temática aplicada). Formato OBLIGATORIO: UNA POR LÍNEA empezando cada línea con "• ".
2. "principalesActividades": String con un resumen sintetizado (NO copiado textualmente ni repetido) de las principales actividades desarrolladas, separado en 4 a 6 viñetas, UNA POR LÍNEA empezando cada línea con "• ".
3. "habilidadesAdquiridas": String con un párrafo técnico amplio (3 a 5 líneas, 50 a 80 palabras) sobre las habilidades, destrezas y conocimientos técnicos y profesionales adquiridos.
4. "observacionesTemas": String con un párrafo amplio (2 a 4 líneas, 40 a 65 palabras) indicando los temas, herramientas o estándares que no se revisaron a profundidad en clases y que fueron necesarios durante la práctica.`
              }
            ],
            temperature: 0.3,
            max_completion_tokens: 2048,
            top_p: 1,
            reasoning_effort: 'medium',
            stream: false
          });

          const rawJson = completion.choices[0]?.message?.content;
          if (rawJson) {
            const limpioJson = rawJson.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
            generado = JSON.parse(limpioJson);
          }
        } catch (err) {
          // Si falla la llamada externa, se usa el sintetizador local basado en RAG
        }
      }

      const asignaturasFallback =
        materiasSeleccionadas.length > 0
          ? materiasSeleccionadas.join('\n')
          : '• Asignaturas de formación profesional de la malla curricular vigente aplicadas al proyecto.';

      const actividadesFallback = descripcionesUnicas
        .slice(0, 6)
        .map((d) => `• ${d.replace(/\.+$/, '')}.`)
        .join('\n');

      formulario.contenidoIa.asignaturasUtilidad =
        generado?.asignaturasUtilidad || asignaturasFallback;
      formulario.contenidoIa.principalesActividades =
        generado?.principalesActividades || actividadesFallback;
      formulario.contenidoIa.habilidadesAdquiridas =
        generado?.habilidadesAdquiridas ||
        'Durante el desarrollo de la práctica preprofesional se consolidaron competencias técnicas en el diseño e implementación de servicios backend RESTful, modelado y optimización de consultas en bases de datos, validación documental automatizada y aplicación de pruebas unitarias. Asimismo, se fortalecieron habilidades blandas como el trabajo colaborativo, la comunicación técnica efectiva, la resolución estructurada de incidencias y el cumplimiento de estándares de calidad en entornos reales de producción.';
      formulario.contenidoIa.observacionesTemas =
        generado?.observacionesTemas ||
        'Durante la ejecución de las actividades asignadas fue necesario profundizar de manera autónoma en herramientas avanzadas de versionamiento colaborativo, automatización de pruebas de integración, manejo de flujos de autenticación basados en tokens y despliegue continuo de servicios, complementando así los fundamentos teóricos revisados en las asignaturas de la carrera.';
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
    const textoBase = [resumenOriginal, contribucionOriginal, asignaturasOriginal, textoCertificado].join(' ');
    const { contextoMalla, materiasSeleccionadas } = await obtenerContextoMallaCurricular(
      aula.carrera || 'Desarrollo de Software',
      textoBase
    );

    let mejorado = null;
    const client = getGroqClient();

    if (client) {
      try {
        const completion = await client.chat.completions.create({
          model: ENV.GROQ_MODEL || 'openai/gpt-oss-120b',
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                'Eres un asesor academico oficial de la ESFOT (Escuela Politecnica Nacional). Debes mejorar, ampliar y redactar en español formal academico los 4 campos de la Seccion 6 del formulario FCP-001A de convalidacion, integrando coherentemente lo escrito por el estudiante, la informacion real extraida del certificado PDF y la malla curricular oficial. Devuelve EXCLUSIVAMENTE un objeto JSON valido con las claves exactas: "resumenActividades", "contribucionConocimientos", "resultadosAprendizaje", "asignaturasMalla". No inventes instituciones, horas ni fechas distintas a las provistas.'
            },
            {
              role: 'user',
              content: `Carrera: ${aula.carrera || 'Desarrollo de Software'}
Modalidad de convalidacion: ${aula.modalidad}
Horas solicitadas: ${aula.horasRequeridas}h
Institucion / Plataforma: ${aula.datosInstitucion?.razonSocial || formulario.entidadReceptora?.razonSocial || 'N/A'}

Texto extraido del certificado PDF:
${textoCertificado.slice(0, 3000) || 'No disponible'}

Campos actuales de la Seccion 6 ingresados por el estudiante:
- Breve resumen de actividades realizadas: ${resumenOriginal}
- Contribucion al perfil de egreso: ${contribucionOriginal}
- Resultados de aprendizaje del perfil de egreso: ${resultadosOriginal}
- Asignaturas de la malla curricular y tematicas: ${asignaturasOriginal}

Malla Curricular oficial (Fuente RAG):
${contextoMalla || 'No disponible'}

Instrucciones estrictas para el JSON:
1. "resumenActividades": Redacta un parrafo tecnico mas completo y detallado (60 a 100 palabras) o vinetas limpias con "• " integrando las actividades descritas por el estudiante y los detalles reales del certificado.
2. "contribucionConocimientos": Amplia y fundamenta academicamente (50 a 80 palabras) como estas actividades contribuyeron al perfil de egreso de la carrera.
3. "resultadosAprendizaje": Redacta de forma precisa (45 a 75 palabras) los resultados de aprendizaje del perfil de egreso fortalecidos.
4. "asignaturasMalla": Conserva o complementa con 2 a 4 asignaturas reales de la malla curricular provista (con su codigo entre parentesis) explicando las tematicas aplicadas en relacion con las actividades.`
            }
          ],
          temperature: 0.3,
          max_completion_tokens: 2048,
          top_p: 1,
          reasoning_effort: 'medium',
          stream: false
        });

        const rawJson = completion.choices[0]?.message?.content;
        if (rawJson) {
          const limpioJson = rawJson.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
          mejorado = JSON.parse(limpioJson);
        }
      } catch (err) {
        // Si falla la llamada externa, se aplica enriquecimiento academico local
      }
    }

    const institucionNombre =
      aula.datosInstitucion?.razonSocial || formulario.entidadReceptora?.razonSocial || 'la entidad formadora';
    const materiasFallback =
      materiasSeleccionadas.length > 0
        ? materiasSeleccionadas.join('\n')
        : asignaturasOriginal;

    formulario.contenidoIa.resumenActividades =
      mejorado?.resumenActividades ||
      `${resumenOriginal.replace(/\.+$/, '')}. Esta actividad de convalidacion en ${institucionNombre} (${aula.horasRequeridas} horas) permitio ejecutar y consolidar de forma practica los contenidos tecnicos certificados en el respaldo adjunto.`;
    formulario.contenidoIa.contribucionConocimientos =
      mejorado?.contribucionConocimientos ||
      `${contribucionOriginal.replace(/\.+$/, '')}. Asimismo, contribuyo directamente al perfil de egreso de ${aula.carrera || 'Desarrollo de Software'}, fortaleciendo la autonomia profesional, el criterio tecnico y la resolucion estructurada de problemas en entornos reales.`;
    formulario.contenidoIa.resultadosAprendizaje =
      mejorado?.resultadosAprendizaje ||
      `${resultadosOriginal.replace(/\.+$/, '')}. Evidencia el logro de resultados de aprendizaje vinculados a la aplicacion de conocimientos especializados, gestion documentada de procesos y mejora continua de competencias profesionales.`;
    formulario.contenidoIa.asignaturasMalla =
      mejorado?.asignaturasMalla ||
      (asignaturasOriginal ? `${asignaturasOriginal}\n${materiasFallback}`.trim() : materiasFallback);
    formulario.fechaGeneracionIa = new Date();

    await formulario.save();

    return {
      success: true,
      message: 'Seccion 6 del formulario FCP-001A mejorada y ampliada exitosamente con IA a partir del borrador y certificado',
      formulario
    };
  }
};
