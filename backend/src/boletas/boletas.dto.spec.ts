import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { randomUUID } from 'crypto';
import { ResponderBoletaDto } from './boletas.dto';
const base = {
  idempotencia: randomUUID(),
  versionHash: 'a'.repeat(64),
  estado: 'REVISION',
  firmanteNombre: 'Tutor Ficticio',
  firmanteTipo: 'TUTOR',
  comentario: 'a'.repeat(2000),
  confirmado: true,
};
it('admite tutor declarado y hasta 2000 caracteres, sin firma dibujada', async () => {
  expect(await validate(plainToInstance(ResponderBoletaDto, base))).toHaveLength(0);
});
it.each([
  { comentario: 'a'.repeat(2001) },
  { confirmado: false },
  { firmanteNombre: ' ' },
  { firmanteTipo: 'ADMINISTRATIVO' },
  { versionHash: 'obsoleta' },
  { estado: 'RECHAZADA' },
])('rechaza respuesta inválida %j', async (cambio) => {
  expect((await validate(plainToInstance(ResponderBoletaDto, { ...base, ...cambio }))).length).toBeGreaterThan(0);
});
