import { jest } from '@jest/globals';
import { adminOrchestrator } from '../src/application/orchestrators/adminOrchestrator.js';
import { usuarioService } from '../src/application/services/usuarioService.js';
import { aulaService } from '../src/application/services/aulaService.js';
import { fuenteService } from '../src/application/services/fuenteService.js';
import { expedienteService } from '../src/application/services/expedienteService.js';
import { ROLES, MODALIDADES, HORAS_REGLAMENTARIAS } from '../src/domain/constants/practicasConstants.js';

describe('Pruebas del modulo Administrador (adminOrchestrator)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Gestion de usuarios por Administrador', () => {
    it('debe registrar un nuevo usuario con rol asignado', async () => {
      const mockUsuario = {
        _id: 'user123',
        cedula: '1723456789',
        nombres: 'Carlos',
        apellidos: 'Mendoza',
        correo: 'carlos.mendoza@epn.edu.ec',
        rol: ROLES.DOCENTE,
        estado: 'activo'
      };

      jest.spyOn(usuarioService, 'crear').mockResolvedValue(mockUsuario);

      const resultado = await adminOrchestrator.crearUsuario({
        cedula: '1723456789',
        nombres: 'Carlos',
        apellidos: 'Mendoza',
        correo: 'carlos.mendoza@epn.edu.ec',
        password: 'Password123*',
        rol: ROLES.DOCENTE
      });

      expect(resultado).toBeDefined();
      expect(resultado.rol).toBe(ROLES.DOCENTE);
      expect(usuarioService.crear).toHaveBeenCalledTimes(1);
    });

    it('debe listar usuarios aplicando filtros de busqueda y rol', async () => {
      const mockLista = [
        { _id: 'u1', nombres: 'Ana', rol: ROLES.ESTUDIANTE },
        { _id: 'u2', nombres: 'Luis', rol: ROLES.ESTUDIANTE }
      ];

      jest.spyOn(usuarioService, 'listarUsuarios').mockResolvedValue(mockLista);

      const resultado = await adminOrchestrator.listarUsuarios({ rol: ROLES.ESTUDIANTE });

      expect(resultado).toHaveLength(2);
      expect(usuarioService.listarUsuarios).toHaveBeenCalledWith({ rol: ROLES.ESTUDIANTE });
    });
  });

  describe('Parametrizacion de Aulas Virtuales 1:1', () => {
    it('debe crear un aula virtual asignando horas reglamentarias segun modalidad laboral', async () => {
      const mockAula = {
        _id: 'aula001',
        nombre: 'Practica Laboral - Periodo 2026-B',
        periodo: '2026-B',
        modalidad: MODALIDADES.LABORAL,
        horasRequeridas: HORAS_REGLAMENTARIAS.LABORAL,
        docenteTutor: 'doc123',
        estudiante: 'est123',
        estado: 'abierta'
      };

      jest.spyOn(aulaService, 'crearAula').mockResolvedValue(mockAula);

      const resultado = await adminOrchestrator.crearAula({
        nombre: 'Practica Laboral - Periodo 2026-B',
        periodo: '2026-B',
        modalidad: MODALIDADES.LABORAL,
        docenteTutor: 'doc123',
        estudiante: 'est123',
        fechaFin: '2026-12-31'
      });

      expect(resultado.modalidad).toBe(MODALIDADES.LABORAL);
      expect(resultado.horasRequeridas).toBe(240);
      expect(aulaService.crearAula).toHaveBeenCalledTimes(1);
    });

    it('debe permitir cambiar de estado a un aula virtual', async () => {
      const mockAulaCerrada = {
        _id: 'aula001',
        estado: 'cerrada'
      };

      jest.spyOn(aulaService, 'cambiarEstadoAula').mockResolvedValue(mockAulaCerrada);

      const resultado = await adminOrchestrator.cambiarEstadoAula('aula001', 'cerrada');
      expect(resultado.estado).toBe('cerrada');
      expect(aulaService.cambiarEstadoAula).toHaveBeenCalledWith('aula001', 'cerrada');
    });
  });

  describe('Ingesta y fuentes institucionales RAG', () => {
    it('debe procesar e indexar un documento normativo', async () => {
      const mockFuente = {
        _id: 'fuente01',
        titulo: 'Reglamento de Regimen Academico RRA',
        categoria: 'reglamento',
        fragmentos: [{ orden: 1, texto: 'Articulo 1...' }],
        activo: true
      };

      jest.spyOn(fuenteService, 'ingestarFuente').mockResolvedValue(mockFuente);

      const resultado = await adminOrchestrator.ingestarFuente(
        {
          titulo: 'Reglamento de Regimen Academico RRA',
          contenido: 'Articulo 1 de la normativa institucional...'
        },
        'adminId'
      );

      expect(resultado.titulo).toContain('RRA');
      expect(fuenteService.ingestarFuente).toHaveBeenCalledTimes(1);
    });
  });

  describe('Dictamen y resolucion de comision sobre expedientes', () => {
    it('debe listar los expedientes pendientes de revision por comision', async () => {
      const mockExpedientes = [
        {
          _id: 'aula001',
          nombre: 'Practica Laboral - Estudiante 1',
          formularioPendiente: { estado: 'pendiente_comision' }
        }
      ];

      jest.spyOn(expedienteService, 'listarExpedientesPendientesComision').mockResolvedValue(mockExpedientes);

      const resultado = await adminOrchestrator.listarExpedientesPendientesComision();

      expect(resultado).toHaveLength(1);
      expect(resultado[0].formularioPendiente.estado).toBe('pendiente_comision');
      expect(expedienteService.listarExpedientesPendientesComision).toHaveBeenCalledTimes(1);
    });

    it('debe registrar el dictamen final de la comision aprobando el expediente', async () => {
      const mockDictamen = {
        success: true,
        message: 'Dictamen de comision procesado exitosamente (aprobado).',
        formularioEstado: 'aprobado',
        actaAprobacion: { _id: 'acta01', dictamen: 'Favorable' },
        aulaEstado: 'cerrada'
      };

      jest.spyOn(expedienteService, 'dictamenFinalComision').mockResolvedValue(mockDictamen);

      const resultado = await adminOrchestrator.dictamenFinalComision('aula001', 'adminId', {
        aprobado: true,
        resolucionNumero: 'RES-CPP-2026-001',
        observaciones: 'Cumple con todos los requisitos normativos'
      });

      expect(resultado.success).toBe(true);
      expect(resultado.formularioEstado).toBe('aprobado');
      expect(expedienteService.dictamenFinalComision).toHaveBeenCalledWith('aula001', 'adminId', {
        aprobado: true,
        resolucionNumero: 'RES-CPP-2026-001',
        observaciones: 'Cumple con todos los requisitos normativos'
      });
    });
  });
});
