import { DataSource } from 'typeorm';
import { ActivacionService } from './activacion.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';

describe('ActivacionService.solicitar', () => {
  const crear = (vigente = true) => {
    const cuenta = { id: 1, email: 'titular@example.test' };
    const usuarios = { findOne: jest.fn().mockResolvedValue(cuenta) };
    const tokens = { update: jest.fn(), insert: jest.fn() };
    const manager = { getRepository: jest.fn((entity) => entity.name === 'Usuario' ? { findOne: jest.fn().mockResolvedValue(vigente ? cuenta : null) } : tokens) };
    const ds = { getRepository: () => usuarios, transaction: jest.fn(async (fn) => fn(manager)) };
    const correo = { enviarEmail: jest.fn().mockResolvedValue({ simulado: false }) };
    return { servicio: new ActivacionService(ds as unknown as DataSource, correo as unknown as NotificacionesService), correo, tokens, usuarios };
  };
  it('no envía invitación si la cuenta deja de estar pendiente antes del bloqueo', async () => {
    const { servicio, correo, tokens } = crear(false);
    await servicio.solicitar('titular@example.test');
    await servicio.onModuleDestroy();
    expect(correo.enviarEmail).not.toHaveBeenCalled();
    expect(tokens.insert).not.toHaveBeenCalled();
  });
  it('responde antes del SMTP y serializa dos reenvíos simultáneos', async () => {
    const { servicio, correo, tokens } = crear();
    let liberar!: () => void;
    const smtp = new Promise<void>((resolve) => { liberar = resolve; });
    correo.enviarEmail.mockImplementationOnce(async () => { await smtp; return { simulado: false }; });
    const respuesta = await servicio.solicitar('titular@example.test');
    await servicio.solicitar('titular@example.test');
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(respuesta).toHaveProperty('mensaje');
    expect(correo.enviarEmail).toHaveBeenCalledTimes(1);
    expect(tokens.insert).toHaveBeenCalledTimes(1);
    liberar();
    await servicio.onModuleDestroy();
    expect(correo.enviarEmail).toHaveBeenCalledTimes(2);
    expect(tokens.insert).toHaveBeenCalledTimes(2);
  });
  it('mantiene respuesta genérica ante fallo de correo sin devolver el código', async () => {
    const { servicio, correo, usuarios } = crear();
    correo.enviarEmail.mockRejectedValueOnce(new Error('Fallo SMTP'));
    const respuesta = await servicio.solicitar('titular@example.test');
    await servicio.onModuleDestroy();
    usuarios.findOne.mockResolvedValueOnce(null);
    expect(await servicio.solicitar('inexistente@example.test')).toEqual(respuesta);
    await servicio.onModuleDestroy();
    const html = correo.enviarEmail.mock.calls[0][2] as string;
    expect(JSON.stringify(respuesta)).not.toContain(html.match(/[a-f0-9]{64}/)![0]);
  });
});
