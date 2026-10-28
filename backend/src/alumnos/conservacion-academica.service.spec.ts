import { ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ScopeService } from '../planteles/scope.service';
import { JwtUser } from '../common/current-user.decorator';
import { stub } from '../test-utils/stub';
import { ConservacionAcademicaService } from './conservacion-academica.service';
import { ConciliarEgresoDto } from './conservacion-academica.dto';

const actor: JwtUser = { sub: 7, email: 'qa@example.invalid', nombre: 'QA', roles: ['ADMINISTRATIVO'] };
const dto: ConciliarEgresoDto = {
  cicloId: 3,
  curp: 'LOPA900101HDFRRL09',
  fechaEgreso: '2020-07-15',
  referenciaDocumental: 'Acta QA-2020',
  confirmado: true,
};
function entorno() {
  const alumno = { id: 1, estatus: 'EGRESADO', plantelId: 2, curp: dto.curp };
  const alumnos = { findOne: jest.fn().mockResolvedValue(alumno), save: jest.fn(), delete: jest.fn() };
  const egresos = {
    findOne: jest.fn().mockResolvedValue(null),
    existsBy: jest.fn().mockResolvedValue(false),
    create: jest.fn().mockImplementation((d: object) => ({ id: 9, ...d })),
    save: jest.fn(),
    delete: jest.fn(),
  };
  const ciclo = { id: 3, estado: 'CERRADO', fechaInicio: '2019-08-01' };
  const ciclos = { findOne: jest.fn().mockResolvedValue(ciclo) };
  const inscripciones = { existsBy: jest.fn().mockResolvedValue(true), update: jest.fn(), delete: jest.fn() };
  const bitacora = { insert: jest.fn() };
  const qb = {
    innerJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    addGroupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue([{ cicloId: 3, nombre: 'Ciclo QA', estado: 'CERRADO', adjuntos: '2' }]),
  };
  const getRepository = jest.fn((entidad: { name: string }) => {
    const repos = {
      Alumno: alumnos,
      EgresoAlumno: egresos,
      CicloEscolar: ciclos,
      Inscripcion: inscripciones,
      BitacoraAcademica: bitacora,
      Entrega: { createQueryBuilder: () => qb },
    };
    const repo = repos[entidad.name as keyof typeof repos];
    if (!repo) throw new Error('Repositorio no autorizado por este escenario');
    return repo;
  });
  const manager = { getRepository };
  const ds = stub<DataSource>({
    getRepository,
    transaction: jest.fn((fn: (m: typeof manager) => Promise<unknown>) => fn(manager)),
  });
  const scope = { validarGestion: jest.fn(), plantelesDe: jest.fn().mockResolvedValue([2]) };
  return {
    service: new ConservacionAcademicaService(ds, stub<ScopeService>(scope)),
    alumno,
    alumnos,
    egresos,
    ciclo,
    ciclos,
    inscripciones,
    bitacora,
    qb,
    scope,
    getRepository,
  };
}
it('mantiene bloqueado el borrado incluso con ciclo cerrado y egreso antiguo', async () => {
  const ctx = entorno();
  const resultado = await ctx.service.revisarAdjuntos(1, actor);
  expect(resultado).toMatchObject({
    eliminacionHabilitada: false,
    pausaDisponible: false,
    egresoConciliado: false,
    ciclos: [{ adjuntos: 2 }],
  });
  expect(resultado.bloqueos).toContain('EGRESO_LEGADO_SIN_CONCILIAR');
  expect(ctx.egresos.save).not.toHaveBeenCalled();
  expect(ctx.alumnos.delete).not.toHaveBeenCalled();
  expect(ctx.inscripciones.delete).not.toHaveBeenCalled();
  expect(JSON.stringify(resultado)).not.toContain('/uploads/');
});
it('rechaza revisión y conciliación fuera del plantel del actor', async () => {
  const ctx = entorno();
  ctx.scope.validarGestion.mockRejectedValue(new ForbiddenException());
  await expect(ctx.service.revisarAdjuntos(1, actor)).rejects.toBeInstanceOf(ForbiddenException);
  await expect(ctx.service.conciliarEgreso(1, dto, actor)).rejects.toBeInstanceOf(ForbiddenException);
  expect(ctx.qb.getRawMany).not.toHaveBeenCalled();
  expect(ctx.egresos.save).not.toHaveBeenCalled();
});
it('registra únicamente la fecha y ciclo documentados y conserva los originales', async () => {
  const ctx = entorno();
  const resultado = await ctx.service.conciliarEgreso(1, dto, actor);
  expect(resultado.fechaEgreso.toISOString()).toBe('2020-07-15T12:00:00.000Z');
  expect(resultado.archivarDesde.toISOString()).toBe('2025-07-15T12:00:00.000Z');
  expect(ctx.egresos.save).toHaveBeenCalledTimes(1);
  expect(ctx.bitacora.insert).toHaveBeenCalledWith(
    expect.objectContaining({ accion: 'EGRESO_CONCILIADO', entidadId: 1 }),
  );
  expect(ctx.alumnos.save).not.toHaveBeenCalled();
  expect(ctx.inscripciones.update).not.toHaveBeenCalled();
  expect(ctx.inscripciones.delete).not.toHaveBeenCalled();
});
it.each(['CURP', 'CICLO_ABIERTO', 'SIN_INSCRIPCION', 'DUPLICADO', 'NO_EGRESADO'])(
  'bloquea conciliación inconsistente: %s',
  async (caso) => {
    const ctx = entorno();
    if (caso === 'CURP') ctx.alumno.curp = 'OTRA900101HDFRRL09';
    if (caso === 'CICLO_ABIERTO') ctx.ciclo.estado = 'ACTIVO';
    if (caso === 'SIN_INSCRIPCION') ctx.inscripciones.existsBy.mockResolvedValue(false);
    if (caso === 'DUPLICADO') ctx.egresos.existsBy.mockResolvedValue(true);
    if (caso === 'NO_EGRESADO') ctx.alumno.estatus = 'BAJA';
    await expect(ctx.service.conciliarEgreso(1, dto, actor)).rejects.toThrow();
    expect(ctx.egresos.save).not.toHaveBeenCalled();
    expect(ctx.bitacora.insert).not.toHaveBeenCalled();
  },
);
it('rechaza fechas futuras o no confirmadas sin escribir', async () => {
  const ctx = entorno();
  await expect(ctx.service.conciliarEgreso(1, { ...dto, confirmado: false }, actor)).rejects.toThrow();
  await expect(ctx.service.conciliarEgreso(1, { ...dto, fechaEgreso: '2099-01-01' }, actor)).rejects.toThrow();
  expect(ctx.egresos.save).not.toHaveBeenCalled();
});
it('exige los datos documentales, fecha civil exacta y confirmación, sin defaults inferidos', async () => {
  expect(await validate(plainToInstance(ConciliarEgresoDto, dto))).toHaveLength(0);
  expect((await validate(plainToInstance(ConciliarEgresoDto, {}))).length).toBeGreaterThan(0);
  expect(
    (await validate(plainToInstance(ConciliarEgresoDto, { ...dto, fechaEgreso: '2020-07-15T00:00:00Z' }))).some(
      (e) => e.property === 'fechaEgreso',
    ),
  ).toBe(true);
});

it('filtra el plantel de las clases históricas tras una transferencia',async()=>{
 const ctx=entorno();await ctx.service.revisarAdjuntos(1,actor);
 expect(ctx.qb.andWhere).toHaveBeenCalledWith('g.plantel_id IN (:...planteles)',{planteles:[2]});
});
it('SUPERADMIN conserva el inventario global',async()=>{
 const ctx=entorno();ctx.scope.plantelesDe.mockResolvedValue(null);await ctx.service.revisarAdjuntos(1,{...actor,roles:['SUPERADMIN']});expect(ctx.qb.andWhere).not.toHaveBeenCalled();
});
