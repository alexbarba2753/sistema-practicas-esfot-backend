import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { ENV } from '../src/infrastructure/config/env.js';

describe('Pruebas Unitarias de Autenticacion y Seguridad (Sprint 1)', () => {
  test('debe hashear contraseñas con bcrypt correctamente', async () => {
    const clavePlana = 'Password123!';
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(clavePlana, salt);

    expect(hash).toBeDefined();
    expect(hash).not.toBe(clavePlana);

    const esValido = await bcrypt.compare(clavePlana, hash);
    expect(esValido).toBe(true);

    const esInvalido = await bcrypt.compare('PasswordErroneo', hash);
    expect(esInvalido).toBe(false);
  });

  test('debe firmar y verificar tokens JWT con expiracion', () => {
    const payload = { id: 'user_123', rol: 'estudiante' };
    const token = jwt.sign(payload, ENV.JWT_SECRET, { expiresIn: '1h' });

    expect(token).toBeDefined();

    const decodificado = jwt.verify(token, ENV.JWT_SECRET);
    expect(decodificado.id).toBe('user_123');
    expect(decodificado.rol).toBe('estudiante');
  });

  test('debe rechazar tokens alterados o con firma invalida', () => {
    const payload = { id: 'user_123' };
    const token = jwt.sign(payload, 'otra_clave_secreta');

    expect(() => jwt.verify(token, ENV.JWT_SECRET)).toThrow();
  });
});
