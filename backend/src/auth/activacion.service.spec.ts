import { DataSource } from 'typeorm';
import { ActivacionService } from './activacion.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';

describe('ActivacionService.solicitar', () => {
  const crear = (vigente = true) => {
    const cuenta = { id: 1, email: 'titular@example.test' };
    const usuarios = { findOne: jest.fn().mockResolvedValue(cuenta) };
    const tokens = { update: jest.fn(), insert: jest.fn() };
    const manager = { getRepository: jest.fn().mockReturnValueOnce({ findOne: jest.fn().mockResolvedValue(vigente ? cuenta : null) }).mockReturnValue(tokens) };
    const ds = { getRepository: () => usuarios, transaction: jest.fn(async (fn) => fn(manager)) };
    const correo = { enviarEmail: jest.fn().mockResolvedValue({ simulado: false }) };
    return { servicio: new ActivacionService(ds as unknown as DataSource, correo as unknown as NotificacionesService), correo, tokens, usuarios };
  };
  it('no envía invitación si la cuenta deja de estar pendiente antes del bloqueo', async () => {
    const { servicio, correo, tokens } = crear(false);
    await servicio.solicitar('titular@example.test');
    expect(correo.enviarEmail).not.toHaveBeenCalled();
    expect(tokens.insert).not.toHaveBeenCalled();
  });
  it('mantiene respuesta genérica ante fallo de correo sin devolver el código', async () => {
    const { servicio, correo, usuarios } = crear();
    correo.enviarEmail.mockRejectedValueOnce(new Error('Fallo SMTP'));
    const respuesta = await servicio.solicitar('titular@example.test');
    usuarios.findOne.mockResolvedValueOnce(null);
    expect(await servicio.solicitar('inexistente@example.test')).toEqual(respuesta);
    const html = correo.enviarEmail.mock.calls[0][2] as string;
    expect(JSON.stringify(respuesta)).not.toContain(html.match(/[a-f0-9]{64}/)![0]);
  });
});
