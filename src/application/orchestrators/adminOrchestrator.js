import { usuarioService } from '../services/usuarioService.js';
import { aulaService } from '../services/aulaService.js';
import { fuenteService } from '../services/fuenteService.js';
import { expedienteService } from '../services/expedienteService.js';

// orquestador para coordinar las operaciones del administrador
export const adminOrchestrator = {
  // registra un nuevo estudiante o docente en el sistema validando la cedula ecuatoriana
  async crearUsuario(datos) {
    return await usuarioService.crear(datos);
  },

  // saca la lista de usuarios registrados con opciones de filtrado por rol o estado
  async listarUsuarios(filtros) {
    return await usuarioService.listarUsuarios(filtros);
  },

  // busca un usuario especifico usando su id para ver sus datos completos
  async obtenerUsuario(id) {
    return await usuarioService.obtenerUsuarioPorId(id);
  },

  // actualiza los datos personales o de contacto del usuario seleccionado
  async actualizarUsuario(id, datos) {
    return await usuarioService.actualizar(id, datos);
  },

  // activa o desactiva la cuenta de un usuario para permitir o bloquear su acceso
  async cambiarEstadoUsuario(id, estado) {
    return await usuarioService.cambiarEstadoUsuario(id, estado);
  },

  // crea una nueva aula virtual para asignar al estudiante con su tutor, procesando opcionalmente la carta o excel inicial
  async crearAula(datos, archivo = null) {
    return await aulaService.crearAula(datos, archivo);
  },

  // lista las aulas virtuales registradas segun el periodo o la modalidad laboral o comunitaria
  async listarAulas(filtros) {
    return await aulaService.listarAulas(filtros);
  },

  // obtiene todos los datos de un aula especifica por su id
  async obtenerAula(id) {
    return await aulaService.obtenerAulaPorId(id);
  },

  // permite modificar fechas o informacion basica del aula virtual
  async actualizarAula(id, datos) {
    return await aulaService.actualizarAula(id, datos);
  },

  // cambia el estado del aula para abrirla o cerrarla segun avance el periodo
  async cambiarEstadoAula(id, estado) {
    return await aulaService.cambiarEstadoAula(id, estado);
  },

  // asigna formalmente a un estudiante al aula virtual para empezar sus practicas
  async asignarEstudiante(aulaId, estudianteId) {
    return await aulaService.asignarEstudiante(aulaId, estudianteId);
  },

  // quita al estudiante asignado si hubo algun cambio de aula o cancelacion
  async desasignarEstudiante(aulaId) {
    return await aulaService.desasignarEstudiante(aulaId);
  },

  // lista los expedientes entregados por tutores para dictamen y resolucion de la comision
  async listarExpedientesPendientesComision() {
    return await expedienteService.listarExpedientesPendientesComision();
  },

  // emite el dictamen final de la comision aprobando la practica o devolviendo al tutor con observaciones
  async dictamenFinalComision(aulaId, adminId, datos) {
    return await expedienteService.dictamenFinalComision(aulaId, adminId, datos);
  },

  // procesa y sube un nuevo reglamento o normativa institucional dividiendolo en partes
  async ingestarFuente(datos, adminId) {
    return await fuenteService.ingestarFuente(datos, adminId);
  },

  // lista los reglamentos y documentos que estan subidos en el sistema
  async listarFuentes(filtros) {
    return await fuenteService.listarFuentes(filtros);
  },

  // busca una normativa o fuente institucional por su id
  async obtenerFuente(id) {
    return await fuenteService.obtenerFuentePorId(id);
  },

  // actualiza el titulo, categoria o texto de una normativa registrada
  async actualizarFuente(id, datos) {
    return await fuenteService.actualizarFuente(id, datos);
  },

  // activa o desactiva un documento normativo para que el asistente lo use o lo ignore
  async cambiarEstadoFuente(id, activo) {
    return await fuenteService.cambiarEstadoFuente(id, activo);
  }
};
