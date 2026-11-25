import { DataSource, EntityManager } from 'typeorm';
import { DocumentosEgresoService } from './documentos-egreso.service';
import { ScopeService } from '../planteles/scope.service';
import { CargosService } from '../finanzas/cargos.service';
import { JwtUser } from '../common/current-user.decorator';
import { Cargo, EgresoAlumno, EgresoDocumento } from '../entities';
import { stub } from '../test-utils/stub';

const actor = (rol: string): JwtUser => ({
  sub: 10,
  nombre: 'Prueba',
  email: 'qa@example.test',
  roles: [rol],
  portal: 'WEB',
});
const evidencia = stub<Express.Multer.File>({ buffer: Buffer.from('%PDF-1.7 QA') });
function entorno(estadoArchivo = 'VIGENTE') {
  const save = jest.fn(async () => ({ id: 17 })),
    update = jest.fn();
  const find = jest.fn(async (entity: unknown) => (entity === Cargo ? [{ id: 4, monto: 100 }] : []));
  const manager = stub<EntityManager>({
    findOne: jest.fn(async () => ({
      id: 3,
      alumnoId: 1,
      alumno: { plantelId: 7, estatus: 'EGRESADO' },
      estadoArchivo,
      archivarDesde: new Date('2099-01-01'),
    })),
    find,
    findOneBy: jest.fn().mockResolvedValue(null),
    insert: jest.fn(),
    save,
    update,
  });
  const transaction = jest.fn((_nivel: string, fn: (m: EntityManager) => unknown) => fn(manager));
  const scope = stub<ScopeService>({ validarGestion: jest.fn(), plantelesDe: jest.fn().mockResolvedValue(null) });
  const pagos = jest.fn().mockResolvedValue(new Map());
  const servicio = new DocumentosEgresoService(
    stub<DataSource>({ transaction, manager }),
    scope,
    stub<CargosService>({ pagadoPorCargo: pagos, totalDeCargo: () => 100 }),
  );
  return { servicio, pagos, save, update, transaction, find };
}
it.each(['ADMINISTRATIVO', 'FINANZAS', 'SUPERADMIN', 'MAESTRO'])(
  'rechaza título solicitado por %s antes de abrir la transacción',
  (rol) => {
    const { servicio, transaction } = entorno();
    expect(() => servicio.expedir('QA', { tipo: 'TITULO' }, actor(rol))).toThrow('función');
    expect(transaction).not.toHaveBeenCalled();
  },
);
it('impide que dirección se atribuya la liberación financiera', () => {
  const { servicio } = entorno();
  expect(() =>
    servicio.evidencia('QA', { tipo: 'NO_ADEUDO', detalle: 'Hoja firmada' }, evidencia, actor('DIRECTOR')),
  ).toThrow('función');
});
it('requiere la hoja firmada para servicio social', () => {
  const { servicio } = entorno();
  expect(() =>
    servicio.evidencia(
      'QA',
      { tipo: 'SERVICIO_SOCIAL', detalle: 'Referencia' },
      undefined,
      actor('ADMINISTRATIVO'),
    ),
  ).toThrow('PDF');
});
it('bloquea no adeudo con un cargo sin liquidar', async () => {
  const { servicio, save } = entorno();
  await expect(
    servicio.evidencia('QA', { tipo: 'NO_ADEUDO', detalle: 'Carta digital' }, evidencia, actor('FINANZAS')),
  ).rejects.toThrow('liquidación');
  expect(save).not.toHaveBeenCalled();
});
it('guarda la referencia digital, el responsable y la hoja íntegra al confirmar el pago', async () => {
  const { servicio, pagos, save, update } = entorno();
  pagos.mockResolvedValue(new Map([[4, 100]]));
  await servicio.evidencia('QA', { tipo: 'NO_ADEUDO', detalle: 'Carta digital' }, evidencia, actor('FINANZAS'));
  expect(update).toHaveBeenCalledWith(EgresoAlumno, 3, { estadoArchivo: 'EN_TRAMITE' });
  expect(save).toHaveBeenCalledWith(
    EgresoDocumento,
    expect.objectContaining({
      detalle: 'Carta digital',
      actorId: 10,
    }),
  );
});
it('bloquea la expedición a dirección sin las tres liberaciones', async () => {
  await expect(entorno().servicio.expedir('QA', { tipo: 'TITULO' }, actor('DIRECTOR'))).rejects.toThrow('Faltan');
});
it('un expediente archivado rechaza nuevas actuaciones', async () => {
  await expect(
    entorno('ARCHIVADO').servicio.expedir('QA', { tipo: 'HISTORIAL' }, actor('ADMINISTRATIVO')),
  ).rejects.toThrow('cerrado');
});
