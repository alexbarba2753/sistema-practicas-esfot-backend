import { describe, it, expect } from '@jest/globals';
import { excelService, limpiarTextoParaExcel } from '../src/application/services/excelService.js';

describe('Servicio de generacion de reportes e informes en Excel', () => {
  describe('limpiarTextoParaExcel', () => {
    it('debe limpiar marcas de formato markdown y asteriscos', () => {
      const textoMarkdown = '## Actividades\n**Desarrollo de API** y pruebas *unitarias*.\n- Tarea 1\n- Tarea 2';
      const textoLimpio = limpiarTextoParaExcel(textoMarkdown);

      expect(textoLimpio).not.toContain('##');
      expect(textoLimpio).not.toContain('**');
      expect(textoLimpio).toContain('Desarrollo de API');
      expect(textoLimpio).toContain('• Tarea 1');
    });

    it('debe retornar cadena vacia si el texto es nulo o indefinido', () => {
      expect(limpiarTextoParaExcel(null)).toBe('');
      expect(limpiarTextoParaExcel(undefined)).toBe('');
      expect(limpiarTextoParaExcel('')).toBe('');
    });
  });

  describe('generarExcelInformeLaboral', () => {
    it('debe generar el buffer y el nombre oficial de archivo F_AA_119 con datos del practicante', async () => {
      const datosMock = {
        aula: {
          fechaInicio: new Date('2026-06-01'),
          fechaFin: new Date('2026-08-31'),
          horasRequeridas: 240
        },
        estudiante: {
          nombres: 'Carlos',
          apellidos: 'Mendoza',
          cedula: '1723456789'
        },
        docente: {
          nombres: 'Ing. Fernando',
          apellidos: 'Gomez',
          cedula: '1712345678'
        },
        formularioPendiente: {
          entidadReceptora: {
            razonSocial: 'Tech Solutions S.A.',
            ruc: '1790011223001',
            direccion: 'Av. Amazonas y Eloy Alfaro',
            correo: 'contacto@techsolutions.ec',
            ciudad: 'Quito',
            telefono: '022345678',
            celular: '0991234567',
            tipoEntidad: 'Privada',
            responsable: 'Lic. Maria Perez',
            tutorEmpresarial: 'Ing. Roberto Silva',
            areaAsignada: 'Desarrollo Backend'
          },
          horarioSemanal: {
            horaInicio: '08:30',
            horaFin: '17:00',
            horasSemanales: 40
          },
          totalHoras: 240,
          contenidoIa: {
            asignaturasUtilidad: 'Bases de Datos, Ingenieria de Software, Redes',
            principalesActividades: 'Construccion de microservicios y despliegues en contenedores.',
            habilidadesAdquiridas: 'Arquitectura de software modular y buenas practicas.',
            observacionesTemas: 'Practicas realizadas de forma exitosa.'
          }
        }
      };

      const resultado = await excelService.generarExcelInformeLaboral(datosMock);

      expect(resultado).toBeDefined();
      expect(resultado.filename).toContain('F_AA_119_Informe_Practicas_Laborales_1723456789.xlsx');
      expect(resultado.buffer).toBeDefined();
      expect(resultado.buffer.length).toBeGreaterThan(1000);
    });
  });

  describe('generarExcelInformeComunitario', () => {
    it('debe generar el buffer y el nombre oficial de archivo FCP_001A con datos de servicio comunitario', async () => {
      const datosMock = {
        aula: {
          fechaInicio: new Date('2026-05-15'),
          fechaFin: new Date('2026-07-20'),
          horasRequeridas: 96
        },
        estudiante: {
          nombres: 'Andrea',
          apellidos: 'Salazar',
          cedula: '1755667788',
          correo: 'andrea.salazar@epn.edu.ec',
          telefono: '0987654321'
        },
        docente: {
          nombres: 'Dra. Patricia',
          apellidos: 'Herrera',
          cedula: '1709876543'
        },
        formularioPendiente: {
          entidadReceptora: {
            razonSocial: 'Fundacion Ayuda Social',
            ruc: '1799887766001',
            direccion: 'Centro Historico',
            ciudad: 'Quito',
            telefono: '022987654',
            correo: 'info@ayudasocial.org',
            tipoEntidad: 'ONG'
          },
          totalHoras: 96,
          contenidoIa: {
            resumenActividades: 'Capacitacion digital a personas de la tercera edad.',
            contribucionConocimientos: 'Alfabetizacion tecnologica comunitaria.',
            resultadosAprendizaje: 'Empatia social y comunicacion asertiva.',
            asignaturasMalla: 'Sistemas de Informacion y Comunicacion Digital'
          }
        }
      };

      const resultado = await excelService.generarExcelInformeComunitario(datosMock);

      expect(resultado).toBeDefined();
      expect(resultado.filename).toContain('FCP_001A_Informe_Convalidacion_Comunitario_1755667788.xlsx');
      expect(resultado.buffer).toBeDefined();
      expect(resultado.buffer.length).toBeGreaterThan(1000);
    });
  });
});
