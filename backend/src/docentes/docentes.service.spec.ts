import { ForbiddenException } from '@nestjs/common';
import { DocentesService } from './docentes.service';
import { JwtUser } from '../common/current-user.decorator';

const admin: JwtUser = {
  sub: 7, email: 'admin@escuela.mx', nombre: 'Admin', roles: ['ADMINISTRATIVO'],
};

describe('DocentesService alcance por plantel', () => {
  const crearServicio = (plantelesDocente: number[]) => {
    const docentes = { findOne: jest.fn().mockResolvedValue({ id: 3, usuarioId: 30 }) };
    const asignaciones = { find: jest.fn().mockResolvedValue(plantelesDocente.map((plantelId) => ({ plantelId }))) };
    const scope = { plantelesDe: jest.fn().mockResolvedValue([1]) };
    const service = new DocentesService(docentes as any, asignaciones as any, {} as any, scope as any, {} as any);
    return { service, docentes, asignaciones };
  };

  it('permite consultar un docente asignado a uno de los planteles del actor', async () => {
    const { service } = crearServicio([1, 2]);
    await expect(service.obtener(3, admin)).resolves.toMatchObject({ id: 3 });
  });

  it('rechaza docentes que solo pertenecen a planteles fuera del alcance del actor', async () => {
    const { service } = crearServicio([2]);
    await expect(service.obtener(3, admin)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('impide modificar globalmente a un docente con asignaciones en otros planteles', async () => {
    const { service } = crearServicio([1, 2]);
    await expect(service.obtener(3, admin, true)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('permite al SUPERADMIN consultar un docente sin consultar asignaciones', async () => {
    const { service, asignaciones } = crearServicio([2]);
    await expect(service.obtener(3, { ...admin, roles: ['SUPERADMIN'] })).resolves.toMatchObject({ id: 3 });
    expect(asignaciones.find).not.toHaveBeenCalled();
  });

  it('en listas muestra solo los nombres de planteles autorizados', async () => {
    const docente = { id: 3, usuarioId: 30 };
    const qb: any = {};
    ['innerJoinAndSelect', 'andWhere', 'orderBy', 'skip', 'take'].forEach((metodo) => {
      qb[metodo] = jest.fn().mockReturnValue(qb);
    });
    qb.getManyAndCount = jest.fn().mockResolvedValue([[docente], 1]);
    const docentes = { createQueryBuilder: jest.fn().mockReturnValue(qb) };
    const asignaciones = { find: jest.fn().mockResolvedValue([
      { usuarioId: 30, plantelId: 1, plantel: { nombre: 'Plantel A' } },
      { usuarioId: 30, plantelId: 2, plantel: { nombre: 'Plantel B' } },
    ]) };
    const scope = { resolverFiltro: jest.fn().mockResolvedValue([1]) };
    const service = new DocentesService(docentes as any, asignaciones as any, {} as any, scope as any, {} as any);

    const resultado = await service.listar(admin, {} as any);

    expect(resultado.datos[0].planteles).toEqual(['Plantel A']);
  });
});
