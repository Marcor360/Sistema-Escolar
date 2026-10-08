import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { ValidateBy } from 'class-validator';

const FORMATO_LIMITADO = '$escolar-bcrypt-v1$';

function passwordValida(value: unknown): value is string {
  return typeof value === 'string' && Buffer.byteLength(value, 'utf8') <= 72 && Buffer.from(value, 'utf8').toString('utf8') === value;
}

export function PasswordNuevaValida(): PropertyDecorator {
  return ValidateBy({ name: 'passwordNuevaValida', validator: { validate: passwordValida, defaultMessage: () => 'La contraseña nueva debe ser texto UTF-8 válido de hasta 72 bytes' } });
}

/** bcrypt solo procesa los primeros 72 bytes: nunca truncar una contraseña nueva. */
export function hashPasswordNueva(password: string): Promise<string> {
  if (!passwordValida(password)) throw new BadRequestException('La contraseña nueva debe ser texto UTF-8 válido de hasta 72 bytes');
  return bcrypt.hash(password, 10).then((hash) => FORMATO_LIMITADO + hash);
}

/** El formato nuevo exige contraseña completa; hashes anteriores conservan login para poder renovarse. */
export function compararPassword(password: string, hash: string): Promise<boolean> {
  if (!hash.startsWith(FORMATO_LIMITADO)) return bcrypt.compare(password, hash);
  if (!passwordValida(password)) return Promise.resolve(false);
  return bcrypt.compare(password, hash.slice(FORMATO_LIMITADO.length));
}
