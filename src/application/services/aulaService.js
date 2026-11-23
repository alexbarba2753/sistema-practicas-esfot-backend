import { AulaVirtual } from '../../infrastructure/database/models/AulaVirtual.js';
import { AulaConvalidacion } from '../../infrastructure/database/models/AulaConvalidacion.js';
import { Usuario } from '../../infrastructure/database/models/Usuario.js';
import { FormularioPendiente } from '../../infrastructure/database/models/FormularioPendiente.js';
import { documentParserService } from './documentParserService.js';
import { MODALIDADES, ROLES, ESTADOS_AULA, HORAS_REGLAMENTARIAS } from '../../domain/constants/practicasConstants.js';
import { errorHttp } from '../../domain/utils/errorHttp.js';

export async function buscarAulaPorIdCualquierTipo(aulaId, { populate = false } = {}) {
  let queryLab = AulaVirtual.findById(aulaId);
  if (populate && typeof queryLab?.populate === 'function') {
    queryLab = queryLab
      .populate('docenteTutor', 'nombres apellidos cedula correo telefono')
      .populate('estudiante', 'nombres apellidos cedula correo telefono estado');
  }
  const aulaLab = await queryLab;
  if (aulaLab) return { aula: aulaLab, esConvalidacion: false };

  let queryConv = AulaConvalidacion.findById(aulaId);
  if (populate && typeof queryConv?.populate === 'function') {
    queryConv = queryConv
      .populate('docenteTutor', 'nombres apellidos cedula correo telefono')
      .populate('estudiante', 'nombres apellidos cedula correo telefono estado');
  }
  const aulaConv = await queryConv;
  if (aulaConv) return { aula: aulaConv, esConvalidacion: true };

  return { aula: null, esConvalidacion: false };
}

export const aulaService = {
  // Crea y parametriza un aula virtual garantizando la relacion 1 a 1 entre docente y estudiante
  // Para practicas laborales exige obligatoriamente los PDFs de cartaAceptacion y SolicitudPracticas
  async crearAula(datos, archivos = null) {
    const {
      nombre,
      periodo,
      modalidad = MODALIDADES.LABORAL,
      carrera,
      docenteTutor,
      estudiante,
      fechaInicio,
      fechaFin
    } = datos;

    if (!nombre || !periodo || !docenteTutor || !estudiante) {
      throw errorHttp('Nombre, periodo, docente tutor y estudiante son obligatorios', 400);
    }

    if (!Object.values(MODALIDADES).includes(modalidad)) {
      throw errorHttp(`Modalidad no valida. Permitidas: ${Object.values(MODALIDADES).join(', ')}`, 400);
    }

    // Verificar docente tutor
    const tutor = await Usuario.findById(docenteTutor);
    if (!tutor || tutor.rol !== ROLES.DOCENTE) {
      throw errorHttp('El docente tutor asignado no existe o no tiene el rol de docente', 400);
    }

    // Verificar estudiante
    const alumno = await Usuario.findById(estudiante);
    if (!alumno || alumno.rol !== ROLES.ESTUDIANTE) {
      throw errorHttp('El estudiante asignado no existe o no tiene el rol de estudiante', 400);
    }

    // Regla de negocio: El estudiante no puede tener otra aula activa en la misma modalidad
    const aulaActiva = await AulaVirtual.findOne({
      estudiante: alumno._id,
      modalidad,
      estado: ESTADOS_AULA.ABIERTA
    });
    if (aulaActiva) {
      throw errorHttp(`El estudiante ya cuenta con un aula virtual activa para la modalidad '${modalidad}'`, 409);
    }

    let fInicio = fechaInicio ? new Date(fechaInicio) : null;
    let fFin = fechaFin ? new Date(fechaFin) : null;

    let horasRequeridas = datos.horasRequeridas
      ? Number(datos.horasRequeridas)
      : modalidad === MODALIDADES.LABORAL
      ? HORAS_REGLAMENTARIAS.LABORAL
      : HORAS_REGLAMENTARIAS.COMUNITARIO;

    let docInicial = {
      tipo: 'manual',
      nombreArchivo: '',
      textoExtraido: '',
      horasExtraidas: null
    };

    let datosEmpresa = {
      razonSocial: datos.razonSocial || '',
      responsable: datos.responsable || '',
      cargo: datos.cargo || '',
      cargoEstudiante: datos.cargoEstudiante || '',
      horasDiarias: datos.horasDiarias ? Number(datos.horasDiarias) : 8,
      totalHorasPactadas: null,
      areaAsignada: datos.areaAsignada || ''
    };

    const cartaFile = archivos?.cartaAceptacion?.[0] || null;
    const solicitudFile = archivos?.SolicitudPracticas?.[0] || null;
    const archivoUnico = archivos?.documento?.[0] || (archivos?.buffer ? archivos : null);

    if (modalidad === MODALIDADES.LABORAL) {
      // Obligatorio: ambos PDFs (cartaAceptacion y SolicitudPracticas)
      const validacion = await documentParserService.validarDocumentosCreacionAula(
        cartaFile,
        solicitudFile,
        alumno
      );

      const { carta, textoCarta, textoSolicitud } = validacion;
      horasRequeridas = carta.totalHoras;
      fInicio = carta.fechaInicio;
      fFin = carta.fechaFin;

      docInicial = {
        tipo: 'carta_aceptacion',
        nombreArchivo: `${cartaFile.originalname} | ${solicitudFile.originalname}`,
        textoExtraido: `${textoCarta}\n\n--- SOLICITUD ---\n${textoSolicitud}`.slice(0, 4000),
        horasExtraidas: carta.totalHoras
      };

      datosEmpresa = {
        razonSocial: carta.razonSocial,
        responsable: carta.responsable || datos.responsable || '',
        cargo: carta.cargoResponsable || datos.cargo || '',
        cargoEstudiante: carta.cargoEstudiante || datos.cargoEstudiante || '',
        cedulaResponsable: carta.cedulaResponsable || datos.cedulaResponsable || '',
        horasDiarias: carta.horasDiarias || 8,
        totalHorasPactadas: carta.totalHoras,
        areaAsignada: carta.areaAsignada || ''
      };
    } else if (archivoUnico && archivoUnico.buffer) {
      docInicial.nombreArchivo = archivoUnico.originalname || 'documento_inicial';
      const texto = await documentParserService.extraerTexto(
        archivoUnico.buffer,
        archivoUnico.originalname,
        archivoUnico.mimetype
      );
      docInicial.textoExtraido = texto.slice(0, 4000);

      const nombreMin = (archivoUnico.originalname || '').toLowerCase();
      if (nombreMin.endsWith('.xlsx') || nombreMin.endsWith('.xlsm')) {
        docInicial.tipo = 'formulario_fcp_001a';
        const datosExcel = await documentParserService.validarYProcesarExcelFcp001a(archivoUnico.buffer);
        horasRequeridas = datosExcel.horasSolicitadas;
        docInicial.horasExtraidas = horasRequeridas;
        datosEmpresa.razonSocial = datosExcel.razonSocial || datosEmpresa.razonSocial;
      }
    }

    if (!fInicio) fInicio = new Date();
    if (!fFin || isNaN(fFin.getTime()) || fFin <= fInicio) {
      throw errorHttp('La fecha fin debe ser valida y posterior a la fecha de inicio', 400);
    }

    const nuevaAula = new AulaVirtual({
      nombre: nombre.trim(),
      periodo: periodo.trim(),
      modalidad,
      carrera: carrera && String(carrera).trim() ? String(carrera).trim() : 'Desarrollo de Software',
      docenteTutor: tutor._id,
      estudiante: alumno._id,
      horasRequeridas,
      fechaInicio: fInicio,
      fechaFin: fFin,
      estado: ESTADOS_AULA.ABIERTA,
      documentoInicial: docInicial,
      datosEmpresa
    });

    await nuevaAula.save();

    // Inicializar FormularioPendiente prellenado con datos de empresa y horas
    await FormularioPendiente.findOneAndUpdate(
      { aulaVirtual: nuevaAula._id },
      {
        $setOnInsert: {
          aulaVirtual: nuevaAula._id,
          estudiante: alumno._id,
          modalidad,
          tipoAula: 'laboral',
          totalHoras: 0,
          creditosAprobados: 0,
          entidadReceptora: {
            razonSocial: datosEmpresa.razonSocial || '',
            areaAsignada: datosEmpresa.areaAsignada || '',
            responsable: datosEmpresa.responsable || '',
            cedulaResponsable: datosEmpresa.cedulaResponsable || ''
          },
          contenidoIa: {
            asignaturasUtilidad: '',
            principalesActividades: '',
            habilidadesAdquiridas: '',
            observacionesTemas: ''
          }
        }
      },
      { upsert: true, new: true }
    );

    return await this.obtenerAulaPorId(nuevaAula._id);
  },

  // Crea un aula temporal de convalidacion validando FCP-001A (Excel) + Certificado (PDF)
  async crearAulaConvalidacion(datos, archivos = null) {
    const {
      nombre,
      periodo,
      modalidad,
      carrera,
      docenteTutor,
      estudiante
    } = datos;

    if (!nombre || !periodo || !modalidad || !docenteTutor || !estudiante) {
      throw errorHttp('Nombre, periodo, modalidad, docente tutor y estudiante son obligatorios', 400);
    }

    if (!Object.values(MODALIDADES).includes(modalidad)) {
      throw errorHttp(`Modalidad no valida. Permitidas: ${Object.values(MODALIDADES).join(', ')}`, 400);
    }

    const tutor = await Usuario.findById(docenteTutor);
    if (!tutor || tutor.rol !== ROLES.DOCENTE) {
      throw errorHttp('El docente tutor asignado no existe o no tiene el rol de docente', 400);
    }

    const alumno = await Usuario.findById(estudiante);
    if (!alumno || alumno.rol !== ROLES.ESTUDIANTE) {
      throw errorHttp('El estudiante asignado no existe o no tiene el rol de estudiante', 400);
    }

    const excelFile = archivos?.formularioFcp001a?.[0] || null;
    const certificadoFile = archivos?.certificado?.[0] || null;

    const { datosExcel, textoCertificado, certificadoAnalisis } =
      await documentParserService.validarDocumentosConvalidacion(excelFile, certificadoFile, modalidad, alumno);

    const resumenExtraidoExcel = [
      `Estudiante: ${datosExcel.estudianteNombre} (${datosExcel.cedula})`,
      `Institucion: ${datosExcel.razonSocial}`,
      `Horas solicitadas: ${datosExcel.horasSolicitadas}`,
      `Resumen: ${datosExcel.resumenActividades}`
    ].join('\n');

    const nuevaAula = new AulaConvalidacion({
      nombre: nombre.trim(),
      periodo: periodo.trim(),
      modalidad,
      carrera: carrera && String(carrera).trim() ? String(carrera).trim() : 'Desarrollo de Software',
      docenteTutor: tutor._id,
      estudiante: alumno._id,
      horasRequeridas: datosExcel.horasSolicitadas,
      fechaInicio: datosExcel.fechaInicio,
      fechaFin: datosExcel.fechaFin,
      estado: ESTADOS_AULA.ABIERTA,
      documentoInicial: {
        tipo: 'formulario_fcp_001a',
        nombreArchivo: excelFile.originalname || 'fcp_001a.xlsx',
        textoExtraido: resumenExtraidoExcel.slice(0, 4000),
        horasExtraidas: datosExcel.horasSolicitadas
      },
      certificadoPdf: {
        nombreArchivo: certificadoFile.originalname || 'certificado.pdf',
        textoExtraido: textoCertificado.slice(0, 8000),
        horasDetectadas: certificadoAnalisis.horasMaximas
      },
      datosInstitucion: {
        razonSocial: datosExcel.razonSocial,
        ruc: datosExcel.ruc,
        direccion: datosExcel.direccion,
        ciudad: datosExcel.ciudad,
        telefono: datosExcel.telefonoInst,
        celular: datosExcel.celularInst,
        correo: datosExcel.correoInst,
        tipoInstitucion: datosExcel.tipoInstitucion,
        campoAmplio: datosExcel.campoAmplio,
        campoEspecifico: datosExcel.campoEspecifico,
        codigoProyecto: datosExcel.codigoProyecto,
        nombreProyecto: datosExcel.nombreProyecto
      },
      seccion1y2Marcas: datosExcel.seccion1y2Marcas
    });

    await nuevaAula.save();

    await FormularioPendiente.findOneAndUpdate(
      { aulaVirtual: nuevaAula._id },
      {
        $setOnInsert: {
          aulaVirtual: nuevaAula._id,
          estudiante: alumno._id,
          modalidad,
          tipoAula: 'convalidacion',
          totalHoras: datosExcel.horasSolicitadas,
          documentacionSoporte: datosExcel.documentacionSoporte,
          seccion1y2Marcas: datosExcel.seccion1y2Marcas,
          fechaDeclaracion: datosExcel.fechaDeclaracion,
          entidadReceptora: {
            razonSocial: datosExcel.razonSocial,
            ruc: datosExcel.ruc,
            direccion: datosExcel.direccion,
            ciudad: datosExcel.ciudad || 'Quito',
            telefono: datosExcel.telefonoInst,
            celular: datosExcel.celularInst,
            correo: datosExcel.correoInst,
            tipoEntidad: datosExcel.tipoInstitucion || 'Privada',
            campoAmplio: datosExcel.campoAmplio,
            campoEspecifico: datosExcel.campoEspecifico,
            codigoProyecto: datosExcel.codigoProyecto,
            nombreProyecto: datosExcel.nombreProyecto
          },
          contenidoIa: {
            resumenActividades: datosExcel.resumenActividades,
            contribucionConocimientos: datosExcel.contribucionConocimientos,
            resultadosAprendizaje: datosExcel.resultadosAprendizaje,
            asignaturasMalla: datosExcel.asignaturasMalla
          }
        }
      },
      { upsert: true, new: true }
    );

    return await this.obtenerAulaPorId(nuevaAula._id);
  },

  async listarAulas(filtros = {}) {
    const query = {};

    if (filtros.periodo) query.periodo = new RegExp(filtros.periodo.trim(), 'i');
    if (filtros.modalidad && Object.values(MODALIDADES).includes(filtros.modalidad)) query.modalidad = filtros.modalidad;
    if (filtros.estado && Object.values(ESTADOS_AULA).includes(filtros.estado)) query.estado = filtros.estado;
    if (filtros.docenteTutor) query.docenteTutor = filtros.docenteTutor;
    if (filtros.estudiante) query.estudiante = filtros.estudiante;

    if (filtros.tipo === 'convalidacion') {
      return await AulaConvalidacion.find(query)
        .populate('docenteTutor', 'nombres apellidos correo telefono')
        .populate('estudiante', 'nombres apellidos correo cedula telefono estado')
        .select('-__v')
        .sort({ createdAt: -1 });
    }

    const aulasLab = await AulaVirtual.find(query)
      .populate('docenteTutor', 'nombres apellidos correo telefono')
      .populate('estudiante', 'nombres apellidos correo cedula telefono estado')
      .select('-__v')
      .sort({ createdAt: -1 });

    if (filtros.tipo === 'laboral') {
      return aulasLab;
    }

    const aulasConv = await AulaConvalidacion.find(query)
      .populate('docenteTutor', 'nombres apellidos correo telefono')
      .populate('estudiante', 'nombres apellidos correo cedula telefono estado')
      .select('-__v')
      .sort({ createdAt: -1 });

    return [...aulasLab, ...aulasConv].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  async obtenerAulaPorId(id) {
    let aula = await AulaVirtual.findById(id)
      .populate('docenteTutor', 'nombres apellidos correo telefono')
      .populate('estudiante', 'nombres apellidos correo cedula telefono estado')
      .select('-__v');

    if (!aula) {
      aula = await AulaConvalidacion.findById(id)
        .populate('docenteTutor', 'nombres apellidos correo telefono')
        .populate('estudiante', 'nombres apellidos correo cedula telefono estado')
        .select('-__v');
    }

    if (!aula) {
      throw errorHttp('Aula virtual no encontrada', 404);
    }
    return aula;
  },

  async actualizarAula(id, datos) {
    const { aula } = await buscarAulaPorIdCualquierTipo(id);
    if (!aula) throw errorHttp('Aula virtual no encontrada', 404);

    if (datos.nombre) aula.nombre = datos.nombre.trim();
    if (datos.periodo) aula.periodo = datos.periodo.trim();
    if (datos.fechaFin) {
      const fFin = new Date(datos.fechaFin);
      if (isNaN(fFin.getTime()) || fFin < aula.fechaInicio) {
        throw errorHttp('La fecha limite debe ser valida y no anterior al inicio', 400);
      }
      aula.fechaFin = fFin;
    }

    if (datos.docenteTutor) {
      const tutor = await Usuario.findById(datos.docenteTutor);
      if (!tutor || tutor.rol !== ROLES.DOCENTE) {
        throw errorHttp('El nuevo docente tutor asignado no es valido', 400);
      }
      aula.docenteTutor = tutor._id;
    }

    await aula.save();
    return await this.obtenerAulaPorId(id);
  },

  async cambiarEstadoAula(id, nuevoEstado) {
    if (!Object.values(ESTADOS_AULA).includes(nuevoEstado)) {
      throw errorHttp(`Estado no valido. Permitidos: ${Object.values(ESTADOS_AULA).join(', ')}`, 400);
    }

    const { aula } = await buscarAulaPorIdCualquierTipo(id);
    if (!aula) throw errorHttp('Aula virtual no encontrada', 404);

    aula.estado = nuevoEstado;
    await aula.save();
    return await this.obtenerAulaPorId(id);
  }
};
