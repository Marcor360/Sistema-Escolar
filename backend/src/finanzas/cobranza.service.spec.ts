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

describe('Seguimiento privado de morosidad', () => {
  const actor = { sub: 10, email: 'finanzas@example.test', nombre: 'Finanzas', roles: ['FINANZAS'] } as Parameters<CobranzaService['pendientes']>[0];
  const cargos = [
    { id:1, alumnoId:11, alumno:{ matricula:'A011', estatus:'ACTIVO', usuarioId:211,
      tutorTelefono:'5551234567', usuario:{ nombreCompleto:'María Pérez', telefono:null, email:'alumno@example.test' } },
      saldo:100, pagado:0, fechaVencimiento:'2020-01-01' },
    { id:2, alumnoId:11, alumno:{ matricula:'A011', estatus:'ACTIVO', usuarioId:211,
      tutorTelefono:'5551234567', usuario:{ nombreCompleto:'María Pérez', telefono:null, email:'alumno@example.test' } },
      saldo:50, pagado:0, fechaVencimiento:'2999-01-01' },
    { id:3, alumnoId:12, alumno:{ matricula:'A012', estatus:'ACTIVO', usuarioId:212,
      tutorTelefono:null, usuario:{ nombreCompleto:'Ernesto Gómez', telefono:null, email:'contacto@example.test' } },
      saldo:30, pagado:20, fechaVencimiento:'2020-01-01' },
    { id:4, alumnoId:13, alumno:{ matricula:'A013', estatus:'BAJA', usuarioId:213,
      tutorTelefono:null, usuario:{ nombreCompleto:'Inactivo', telefono:null, email:'baja@example.test' } },
      saldo:80, pagado:0, fechaVencimiento:'2020-01-01' },
  ];
  it('agrupa deuda en alumnos únicos y restringe teléfonos a los destinatarios activos', async () => {
    const svc = new CobranzaService({findOneBy:jest.fn().mockResolvedValue({})} as never,
      {adeudos:jest.fn().mockResolvedValue(cargos)} as never, {} as never, {} as never, new ConfigService(),
      {} as never, { validarGestion:jest.fn().mockResolvedValue(undefined) } as never);
    const r = await svc.pendientes(actor, {plantelId:7,sinAbono:true,situacion:'VENCIDOS',pagina:1,porPagina:10});
    expect(r.total).toBe(1);
    expect(r.datos[0]).toMatchObject({ matricula:'A011',telefono:'5551234567',saldo:150,numeroCargos:2,vencidos:1 });
    expect(r.resumen).toMatchObject({ alumnosConSaldo:2,sinAbono:1,conAbonoParcial:1 });
    expect(JSON.stringify(r)).not.toContain('baja@example.test');
  });
  it('masivo filtrado excluye alumnos con abonos en cargos abiertos',async()=>{
    const svc = new CobranzaService({findOneBy:jest.fn().mockResolvedValue({})} as never,
      {adeudos:jest.fn().mockResolvedValue(cargos)} as never, {} as never, {} as never, new ConfigService(),
      {} as never, {} as never);
    const r = await svc.enviarAvisos(actor,7,true,false,false,true);
    expect(r).toEqual({ plantelId:7,registros:1,totalEstimado:150 });
  });
});
