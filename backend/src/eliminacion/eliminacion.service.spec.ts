import { ConflictException } from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';
import { EliminacionService } from './eliminacion.service';

const actor = { sub: 1, email: 'root@example.test', nombre: 'Root', roles: ['SUPERADMIN'] };
const fallo = (datos: object) => new QueryFailedError('DELETE', [], Object.assign(new Error('Prueba'), datos));

it.each([{ number: 1205 }, { originalError: { info: { number: 1205 } } }, { errno: 1213, code: 'ER_LOCK_DEADLOCK' }])(
  'repite toda la transacción tras un interbloqueo reconocido: %j', async (datos) => {
    const transaction = jest.fn().mockRejectedValueOnce(fallo(datos)).mockResolvedValue({ ok: true, eliminado: true });
    const service = new EliminacionService({ transaction } as unknown as DataSource);
    await expect(service.eliminar('alumnos', 17, actor)).resolves.toEqual({ ok: true, eliminado: true });
    expect(transaction).toHaveBeenCalledTimes(2);
    expect(transaction.mock.calls.every(([aislamiento]) => aislamiento === 'SERIALIZABLE')).toBe(true);
  },
);

it('limita los reintentos de interbloqueo y devuelve un conflicto accionable', async () => {
  const transaction = jest.fn().mockRejectedValue(fallo({ number: 1205 }));
  const service = new EliminacionService({ transaction } as unknown as DataSource);
  await expect(service.eliminar('usuarios', 17, actor)).rejects.toBeInstanceOf(ConflictException);
  expect(transaction).toHaveBeenCalledTimes(3);
});

it.each([{ number: 547 }, { originalError: { info: { number: 547 } } }, { errno: 1451 }])(
  'no reintenta una referencia de historial: %j', async (datos) => {
    const transaction = jest.fn().mockRejectedValue(fallo(datos));
    const service = new EliminacionService({ transaction } as unknown as DataSource);
    await expect(service.eliminar('usuarios', 17, actor)).rejects.toBeInstanceOf(ConflictException);
    expect(transaction).toHaveBeenCalledTimes(1);
  },
);
