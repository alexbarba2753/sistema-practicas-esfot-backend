import { dividirEnFragmentos } from '../src/domain/utils/textChunker.js';

describe('Pruebas unitarias de fragmentacion de textos (textChunker)', () => {
  it('debe devolver un arreglo vacio si el texto es nulo, indefinido o vacio', () => {
    expect(dividirEnFragmentos('')).toEqual([]);
    expect(dividirEnFragmentos(null)).toEqual([]);
    expect(dividirEnFragmentos('   ')).toEqual([]);
  });

  it('debe dividir parrafos correctamente respetando el limite maximo de palabras', () => {
    const p1 = 'Este es el primer parrafo de la normativa de practicas preprofesionales.';
    const p2 = 'Este es el segundo parrafo que contiene detalles sobre los requisitos de aprobacion.';
    const texto = `${p1}\n\n${p2}`;

    const resultado = dividirEnFragmentos(texto, 100);
    expect(resultado.length).toBe(1);
    expect(resultado[0].orden).toBe(1);
    expect(resultado[0].texto).toContain(p1);
  });

  it('debe generar multiples fragmentos cuando el texto excede el limite de palabras', () => {
    const palabrasLargas = Array(120).fill('reglamento').join(' ');
    const parrafo2 = Array(80).fill('estudiante').join(' ');
    const texto = `${palabrasLargas}\n\n${parrafo2}`;

    const resultado = dividirEnFragmentos(texto, 100);
    expect(resultado.length).toBe(2);
    expect(resultado[0].orden).toBe(1);
    expect(resultado[1].orden).toBe(2);
  });
});
