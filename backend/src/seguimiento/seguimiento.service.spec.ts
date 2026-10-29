import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { ForbiddenException } from '@nestjs/common';
import { Alumno, AperturaCartera } from '../entities';
import { JwtUser } from '../common/current-user.decorator';
import { ScopeService } from '../planteles/scope.service';
import { stub } from '../test-utils/stub';
import { SeguimientoService } from './seguimiento.service';
function preparar(permitidos: number[] | null = [4]) {
  const consultas: { entidad: unknown; condiciones: string[]; qb: Record<string, jest.Mock> }[] = [];
  function crear(entidad: unknown, condiciones: string[] = []) {
    const qb: Record<string, jest.Mock> = {};
    for (const metodo of ['innerJoin', 'where', 'andWhere'])
      qb[metodo] = jest.fn((sql: string) => {
        condiciones.push(sql);
        return qb;
      });
    qb.clone = jest.fn(() => crear(entidad, [...condiciones]));
    qb.getCount = jest.fn().mockResolvedValue(entidad === AperturaCartera ? 3 : 2);
    consultas.push({ entidad, condiciones, qb });
    return qb;
  }
  const ds = { getRepository: jest.fn((entidad) => ({ createQueryBuilder: () => crear(entidad) })) };
  const scope = { resolverFiltro: jest.fn().mockResolvedValue(permitidos) };
  return {
    service: new SeguimientoService(stub<DataSource>(ds), stub<ScopeService>(scope), stub<ConfigService>({})),
    scope,
    consultas,
    ds,
  };
}
const actor = (roles: string[]): JwtUser => ({ sub: 7, email: 'qa@example.invalid', nombre: 'QA', roles });
it('separa alumnos sin correo de activaciones y conserva el plantel en enlaces de resolución', async () => {
  const { service, scope, consultas } = preparar();
  const pendientes = await service.pendientes(actor(['ADMINISTRATIVO']), 4);
  expect(scope.resolverFiltro).toHaveBeenCalledWith(expect.anything(), 4);
  expect(pendientes).toEqual(
    expect.arrayContaining([
      {
        titulo: 'Alumnos sin correo institucional',
        cantidad: 2,
        ruta: '/usuarios?vista=consulta&tipo=ALUMNO&sinCorreo=true&plantel=4',
      },
      {
        titulo: 'Alumnos con activación pendiente',
        cantidad: 2,
        ruta: '/usuarios?vista=consulta&tipo=ALUMNO&activacionPendiente=true&plantel=4',
      },
      { titulo: 'Carteras en pausa', cantidad: 3, ruta: '/apertura-cartera?vista=consulta&estado=PAUSA&plantelId=4' },
    ]),
  );
  const operativas = consultas.filter((c) => [Alumno, AperturaCartera].includes(c.entidad as typeof Alumno));
  expect(operativas.every((c) => c.condiciones.some((sql) => sql.includes('plantel_id IN')))).toBe(true);
  expect(
    operativas.some((c) => c.condiciones.some((sql) => sql.includes('u.email IS NOT NULL AND u.activacion_pendiente'))),
  ).toBe(true);
});
it('Finanzas no obtiene pendientes administrativos de acceso ni cartera por su rol', async () => {
  const { service, ds } = preparar();
  const pendientes = await service.pendientes(actor(['FINANZAS']), 4);
  expect(pendientes.some((p) => /correo|activación|pausa/.test(p.titulo))).toBe(false);
  expect(ds.getRepository).not.toHaveBeenCalledWith(Alumno);
  expect(ds.getRepository).not.toHaveBeenCalledWith(AperturaCartera);
});
it('rechaza un plantel fuera del alcance antes de contar expedientes', async () => {
  const { service, scope, ds } = preparar();
  scope.resolverFiltro.mockRejectedValue(new ForbiddenException());
  await expect(service.pendientes(actor(['ADMINISTRATIVO']), 99)).rejects.toThrow(ForbiddenException);
  expect(ds.getRepository).not.toHaveBeenCalled();
});
it('no permite al maestro consultar pendientes de otro plantel por parámetro', async () => {
  const { service, ds } = preparar();
  await expect(service.pendientes(actor(['MAESTRO']), 4)).rejects.toThrow(ForbiddenException);
  expect(ds.getRepository).not.toHaveBeenCalled();
});
it('Superadmin consulta globalmente sin imponer un plantel inventado', async () => {
  const { service, consultas } = preparar(null);
  const pendientes = await service.pendientes(actor(['SUPERADMIN']));
  expect(pendientes.find((p) => p.titulo === 'Carteras en pausa')?.ruta).toBe(
    '/apertura-cartera?vista=consulta&estado=PAUSA',
  );
  expect(
    consultas
      .filter((c) => c.entidad === Alumno || c.entidad === AperturaCartera)
      .every((c) => !c.condiciones.some((sql) => sql.includes('plantel_id IN'))),
  ).toBe(true);
});
