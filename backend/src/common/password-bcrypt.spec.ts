import { validateSync } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import * as bcrypt from 'bcryptjs';
import { compararPassword, hashPasswordNueva } from './password-bcrypt';
import { CambiarPasswordDto, LoginDto, ResetPasswordDto } from '../auth/dto/auth.dto';

it('evita que bcrypt acepte como iguales dos contraseñas con sufijos distintos truncados', async () => {
  const prefijo = 'x'.repeat(72), original = `${prefijo}uno`, distinta = `${prefijo}dos`;
  const hashLegacy = await bcrypt.hash(original,4);
  expect(await bcrypt.compare(distinta,hashLegacy)).toBe(true);
  expect(() => hashPasswordNueva(original)).toThrow('72 bytes');
  const nuevo = await hashPasswordNueva(prefijo);
  expect(nuevo.length).toBeLessThanOrEqual(100);
  expect(await compararPassword(prefijo,nuevo)).toBe(true);
  expect(await compararPassword(original,nuevo)).toBe(false);
  expect(await compararPassword(original,hashLegacy)).toBe(true);
  // No bloquea el login de cuentas existentes; la restricción se aplica al reemplazar su contraseña.
  expect(validateSync(plainToInstance(LoginDto,{ email: 'legacy@example.invalid',password: original }))).toHaveLength(0);
});
it('cuenta bytes UTF-8 y permite el límite exacto sin truncar caracteres', async () => {
  const valido = 'á'.repeat(36); expect(await compararPassword(valido,await hashPasswordNueva(valido))).toBe(true);
  expect(() => hashPasswordNueva('á'.repeat(37))).toThrow('72 bytes');
  expect(validateSync(plainToInstance(CambiarPasswordDto,{ actual: 'actual',nueva: '🙂'.repeat(19) })).map((e) => e.property)).toContain('nueva');
  expect(validateSync(plainToInstance(ResetPasswordDto,{ token: 'token',password: 'á'.repeat(37) })).map((e) => e.property)).toContain('password');
});

it('rechaza Unicode mal formado como validación, sin URIError ni reemplazos silenciosos', () => {
  const invalida = '\ud800'.repeat(8);
  expect(() => validateSync(plainToInstance(ResetPasswordDto,{ token: 'token',password: invalida }))).not.toThrow();
  expect(validateSync(plainToInstance(ResetPasswordDto,{ token: 'token',password: invalida })).map((e) => e.property)).toContain('password');
  expect(() => hashPasswordNueva(invalida)).toThrow('UTF-8 válido');
});
