import { ConfigService } from '@nestjs/config';
import { CobranzaService } from './cobranza.service';

function preparar(env: Record<string, string> = {}) {
  const usuario = { id: 10, email: 'finanzas@example.test', nombre: 'Finanzas', roles: [{ clave: 'FINANZAS' }] };
  const repo = { findOneBy: jest.fn().mockResolvedValue(usuario) };
  const ds = { getRepository: jest.fn().mockReturnValue(repo) };
  const cargos = { aplicarRecargos: jest.fn().mockResolvedValue({ aplicados: 1 }), adeudos: jest.fn() };
  const scope = { plantelesDe: jest.fn().mockResolvedValue([3, 4]) };
  const service = new CobranzaService(
    { findOneBy: jest.fn().mockResolvedValue({}) } as any, cargos as any, {} as any, {} as any,
    new ConfigService(env), ds as any, scope as any,
  );
  return { service, cargos, scope, repo, ds };
}

describe('Automatización financiera optativa', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('no consulta datos ni genera operaciones sin banderas', async () => {
    const { service, ds, cargos } = preparar();
    await service['ejecutarAutomaticos']();
    expect(ds.getRepository).not.toHaveBeenCalled();
    expect(cargos.aplicarRecargos).not.toHaveBeenCalled();
  });

  it('envía el día 3 mexicano aunque UTC ya sea día 4, solo en los planteles asignados', async () => {
    jest.setSystemTime(new Date('2026-11-04T02:00:00Z'));
    const { service, cargos } = preparar({ COBRANZA_DIA3_HABILITADA: 'true', FINANZAS_AUTO_ACTOR_ID: '10', SMTP_HOST: 'smtp.example.test' });
    const avisos = jest.spyOn(service, 'enviarAvisos').mockResolvedValue({ programados: 0, omitidos: 0, mensaje: '' });
    await service['ejecutarAutomaticos']();
    expect(avisos).toHaveBeenCalledTimes(2);
    expect(avisos).toHaveBeenCalledWith(expect.objectContaining({ sub: 10 }), 3, false, true, true);
    expect(avisos).toHaveBeenCalledWith(expect.objectContaining({ sub: 10 }), 4, false, true, true);
    expect(cargos.aplicarRecargos).not.toHaveBeenCalled();
  });

  it('aplica desde día 4 local, una vez al día, sin adelantar por la fecha UTC', async () => {
    const { service, cargos } = preparar({ RECARGOS_AUTOMATICOS_HABILITADOS: 'true', FINANZAS_AUTO_ACTOR_ID: '10' });
    jest.setSystemTime(new Date('2026-11-04T02:00:00Z'));
    await service['ejecutarAutomaticos']();
    expect(cargos.aplicarRecargos).not.toHaveBeenCalled();
    jest.setSystemTime(new Date('2026-11-04T12:00:00Z'));
    await service['ejecutarAutomaticos']();
    await service['ejecutarAutomaticos']();
    expect(cargos.aplicarRecargos).toHaveBeenCalledTimes(2);
    expect(cargos.aplicarRecargos).toHaveBeenCalledWith({ plantelId: 3, porcentaje: 10, confirmado: true }, expect.objectContaining({ sub: 10 }));
  });

  it('rechaza un actor inactivo o sin rol FINANZAS', async () => {
    jest.setSystemTime(new Date('2026-11-04T12:00:00Z'));
    const { service, repo, cargos } = preparar({ RECARGOS_AUTOMATICOS_HABILITADOS: 'true', FINANZAS_AUTO_ACTOR_ID: '10' });
    repo.findOneBy.mockResolvedValueOnce(null).mockResolvedValueOnce({ roles: [{ clave: 'ALUMNO' }] });
    await expect(service['ejecutarAutomaticos']()).rejects.toThrow('FINANZAS activo');
    await expect(service['ejecutarAutomaticos']()).rejects.toThrow('FINANZAS activo');
    expect(repo.findOneBy).toHaveBeenCalledWith({ id: 10, activo: true });
    expect(cargos.aplicarRecargos).not.toHaveBeenCalled();
  });

  it('bloquea actores sin planteles asignados', async () => {
    jest.setSystemTime(new Date('2026-11-04T12:00:00Z'));
    const { service, scope, cargos } = preparar({ RECARGOS_AUTOMATICOS_HABILITADOS: 'true', FINANZAS_AUTO_ACTOR_ID: '10' });
    scope.plantelesDe.mockResolvedValue([]);
    await expect(service['ejecutarAutomaticos']()).rejects.toThrow('planteles asignados');
    expect(cargos.aplicarRecargos).not.toHaveBeenCalled();
  });

  it('el aviso automático excluye vencimientos de hoy, futuros y ausentes', async () => {
    jest.setSystemTime(new Date('2026-11-03T12:00:00Z'));
    const { service, cargos } = preparar();
    cargos.adeudos.mockResolvedValue(['2026-11-02', '2026-11-03', '2026-11-05', null].map((fechaVencimiento, id) => ({
      id, alumnoId: id, alumno: { usuarioId: id }, saldo: 100, fechaVencimiento,
    })));
    const actor = { sub: 10, email: '', nombre: '', roles: ['FINANZAS'] };
    expect(await service.enviarAvisos(actor, 3, true, false, true)).toEqual({ plantelId: 3, registros: 1, totalEstimado: 100 });
  });
});
