import { validarCedula } from '../src/domain/utils/validarCedula.js';

describe('Validacion de Cedula Ecuatoriana (Modulo 10)', () => {
  test('debe aceptar cedulas validas de 10 digitos', () => {
    expect(validarCedula('1710034065')).toBe(true);
    expect(validarCedula('1720000007')).toBe(true);
  });

  test('debe rechazar cedulas con longitud distinta a 10', () => {
    expect(validarCedula('172999')).toBe(false);
    expect(validarCedula('17299900021')).toBe(false);
  });

  test('debe rechazar provincia invalida', () => {
    expect(validarCedula('5029990002')).toBe(false);
    expect(validarCedula('0029990002')).toBe(false);
  });

  test('debe rechazar tercer digito mayor o igual a 6', () => {
    expect(validarCedula('1769990002')).toBe(false);
  });

  test('debe rechazar valores nulos, vacios o con letras', () => {
    expect(validarCedula('172999000A')).toBe(false);
    expect(validarCedula('')).toBe(false);
    expect(validarCedula(null)).toBe(false);
  });
});
