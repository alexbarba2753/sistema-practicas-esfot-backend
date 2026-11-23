import { describe, it, expect } from '@jest/globals';
import { validarYCalcularHorarioSemanal } from '../src/domain/utils/validarHorario.js';

describe('Validacion y calculo de horario semanal (validarHorario)', () => {
  const aula80h = {
    fechaInicio: new Date('2026-04-01T00:00:00Z'),
    fechaFin: new Date('2026-04-30T00:00:00Z'),
    horasRequeridas: 80
  };

  it('debe calcular horas semanales y proyectadas con bloques normales y cortados', () => {
    const datos = {
      lunes: [{ horaInicio: '08:00', horaFin: '13:00' }],
      martes: [
        { horaInicio: '08:00', horaFin: '11:00' },
        { horaInicio: '14:00', horaFin: '17:00' }
      ],
      miercoles: [{ horaInicio: '08:00', horaFin: '13:00' }],
      jueves: [{ horaInicio: '08:00', horaFin: '13:00' }],
      viernes: [{ horaInicio: '08:00', horaFin: '13:00' }]
    };

    const res = validarYCalcularHorarioSemanal(datos, aula80h);
    expect(res.horasSemanales).toBe(26);
    expect(res.horasProyectadas).toBeGreaterThanOrEqual(80);
    expect(res.horarioNormalizado.sabado).toEqual([]);
  });

  it('debe rechazar si las horas proyectadas en el periodo del aula no cubren la carta de aceptacion', () => {
    const datosInsuficientes = {
      lunes: [{ horaInicio: '08:00', horaFin: '10:00' }],
      miercoles: [{ horaInicio: '08:00', horaFin: '10:00' }]
    };

    expect(() => validarYCalcularHorarioSemanal(datosInsuficientes, aula80h)).toThrow(
      'no cubre el tiempo acordado en la carta de aceptacion'
    );
  });

  it('debe rechazar si los bloques de un mismo dia se traslapan o superan 8 horas diarias', () => {
    const datosTraslape = {
      lunes: [
        { horaInicio: '08:00', horaFin: '12:00' },
        { horaInicio: '11:00', horaFin: '14:00' }
      ]
    };

    expect(() => validarYCalcularHorarioSemanal(datosTraslape, aula80h)).toThrow('se traslapan');

    const datosExceso = {
      lunes: [
        { horaInicio: '08:00', horaFin: '13:00' },
        { horaInicio: '14:00', horaFin: '18:00' }
      ]
    };

    expect(() => validarYCalcularHorarioSemanal(datosExceso, aula80h)).toThrow('excede el maximo reglamentario de 8 horas');
  });
});
