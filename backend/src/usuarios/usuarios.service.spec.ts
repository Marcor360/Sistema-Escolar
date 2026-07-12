import { UsuariosService } from './usuarios.service';
import { JwtUser } from '../common/current-user.decorator';

function crearQb() {
  const qb: any = {};
  ['innerJoinAndSelect', 'leftJoinAndSelect', 'andWhere', 'orderBy', 'skip', 'take'].forEach((metodo) => {
    qb[metodo] = jest.fn().mockReturnValue(qb);
  });
  qb.getManyAndCount = jest.fn().mockResolvedValue([[], 0]);
  return qb;
}

describe('UsuariosService.listado — alcance de alumnos por rol', () => {
  it('un maestro puro aplica la subconsulta EXISTS de inscripciones/grupo_materias/docentes', async () => {
    const qb = crearQb();
    const alumnosRepo = { createQueryBuilder: jest.fn().mockReturnValue(qb) };
    const scope = { resolverFiltro: jest.fn() };
    const service = new UsuariosService({} as any, {} as any, alumnosRepo as any, {} as any, {} as any, scope as any);
    const user: JwtUser = { sub: 9, email: 'm@escuela.mx', nombre: 'Maestro', roles: ['MAESTRO'] };

    await service.listado({ tipo: 'ALUMNO', pagina: 1, porPagina: 20 } as any, user);

    expect(qb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('EXISTS'),
      expect.objectContaining({ actorId: 9 }),
    );
    expect(scope.resolverFiltro).not.toHaveBeenCalled();
  });

  it('un ADMINISTRATIVO no aplica la subconsulta EXISTS; usa el alcance de planteles', async () => {
    const qb = crearQb();
    const alumnosRepo = { createQueryBuilder: jest.fn().mockReturnValue(qb) };
    const scope = { resolverFiltro: jest.fn().mockResolvedValue(null) };
    const service = new UsuariosService({} as any, {} as any, alumnosRepo as any, {} as any, {} as any, scope as any);
    const user: JwtUser = { sub: 3, email: 'a@escuela.mx', nombre: 'Admin', roles: ['ADMINISTRATIVO'] };

    await service.listado({ tipo: 'ALUMNO', pagina: 1, porPagina: 20 } as any, user);

    expect(scope.resolverFiltro).toHaveBeenCalledWith(user, undefined);
    const llamadasExists = qb.andWhere.mock.calls.filter(([sql]: [string]) => typeof sql === 'string' && sql.includes('EXISTS'));
    expect(llamadasExists).toHaveLength(0);
  });
});
