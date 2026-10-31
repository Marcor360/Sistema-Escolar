import { AuthCorreoEventosService } from './auth-correo-eventos.service';
import { AuthCorreoEvento } from '../entities/auth-correo-evento.entity';

describe('AuthCorreoEventosService', () => {
  it('persiste un aviso por identificador de sesión, sin almacenar el correo ni credenciales', async () => {
    const insert = jest.fn().mockResolvedValue({ identifiers: [{ id: 'sesion-1' }] });
    const manager = { getRepository: jest.fn((entidad: unknown) => {
      expect(entidad).toBe(AuthCorreoEvento);
      return { insert };
    }) };
    const servicio = new AuthCorreoEventosService(
      { manager } as never, {} as never, {} as never,
    );
    await servicio.encolar(7, 'INGRESO', 'sesion-1');
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      id: 'sesion-1', usuarioId: 7, tipo: 'INGRESO',
      estado: 'PENDIENTE', intentos: 0,
    }));
    const registro = JSON.stringify(insert.mock.calls[0][0]);
    expect(registro).not.toContain('password');
    expect(registro).not.toContain('@');
  });

  it('utiliza el manager de la operación para persistir el aviso de cambio', async () => {
    const insert = jest.fn().mockResolvedValue({ identifiers: [{}] });
    const manager = { getRepository: jest.fn(() => ({ insert })) };
    const servicio = new AuthCorreoEventosService({} as never, {} as never, {} as never);
    await servicio.encolarEnTransaccion(manager as never, 11, 'CAMBIO_PASSWORD');
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert.mock.calls[0][0]).toEqual(expect.objectContaining({
      usuarioId: 11, tipo: 'CAMBIO_PASSWORD', estado: 'PENDIENTE',
    }));
  });
});
