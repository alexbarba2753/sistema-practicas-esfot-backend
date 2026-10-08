import { validarJornadaLaboral, validarActividadComunitariaDatos } from '../src/domain/utils/validarActividad.js';

describe('Pruebas unitarias de validacion de actividades (validarActividad)', () => {
  const mockAula = {
    fechaInicio: new Date('2026-09-01T00:00:00Z'),
    horasRequeridas: 240
  };

  it('debe validar exitosamente una jornada laboral con datos correctos', () => {
    const datos = {
      fecha: '2026-10-01',
      horaEntrada: '08:00',
      horaSalida: '16:00',
      horas: 8,
      descripcion: 'Desarrollo de modulos backend con Node.js y MongoDB'
    };

    const resultado = validarJornadaLaboral(datos, mockAula, {});
    expect(resultado).toBeDefined();
    expect(resultado.horas).toBe(8);
    expect(resultado.horaEntrada).toBe('08:00');
    expect(resultado.horaSalida).toBe('16:00');
  });

  it('debe rechazar si la hora de salida es anterior o igual a la de entrada', () => {
    const datos = {
      fecha: '2026-10-01',
      horaEntrada: '14:00',
      horaSalida: '10:00',
      horas: 4,
      descripcion: 'Correccion de pruebas y endpoints del sistema'
    };

    expect(() => validarJornadaLaboral(datos, mockAula, {})).toThrow(
      'La hora de salida debe ser posterior a la hora de entrada'
    );
  });

  it('debe rechazar si las horas no estan en bloques de 10 minutos', () => {
    const datos = {
      fecha: '2026-10-01',
      horaEntrada: '08:00',
      horaSalida: '12:00',
      horas: 3.25, // 195 minutos (no divisible para 10)
      descripcion: 'Documentacion y pruebas de cobertura unitaria'
    };

    expect(() => validarJornadaLaboral(datos, mockAula, {})).toThrow(
      'El numero de horas debe registrarse en fracciones de bloques de 10 minutos'
    );
  });

  it('debe rechazar si supera el maximo diario de 8 horas', () => {
    const datos = {
      fecha: '2026-10-01',
      horaEntrada: '08:00',
      horaSalida: '18:00',
      horas: 9,
      descripcion: 'Jornada extendida de soporte tecnico a usuarios'
    };

    expect(() => validarJornadaLaboral(datos, mockAula, {})).toThrow(
      'El numero de horas diarias debe ser un valor entre 0.5 y 8 horas reglamentarias'
    );
  });

  it('debe validar actividades comunitarias con horas dentro del rango', () => {
    const datos = {
      comunidadOInstitucion: 'Barrio La Floresta',
      horas: 20,
      descripcion: 'Capacitacion de alfabetizacion digital a adultos mayores'
    };

    const res = validarActividadComunitariaDatos(datos, {}, {});
    expect(res.horas).toBe(20);
    expect(res.comunidadOInstitucion).toBe('Barrio La Floresta');
  });
});
