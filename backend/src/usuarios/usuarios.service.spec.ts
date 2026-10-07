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

describe('UsuariosService.actualizar revoca sesiones', () => {
  it('invalida los tokens previos al reactivar una cuenta desactivada', async () => {
    const cuenta = {
      id: 1, email: 'a@escuela.mx', passwordHash: 'hash', nombre: 'A', apellidoPaterno: 'B',
      apellidoMaterno: null as string | null, telefono: null as string | null, activo: false, sessionVersion: 2, roles: [] as string[],
    };
    const usuarios = {
      findOne: jest.fn().mockResolvedValue(cuenta),
      save: jest.fn(async (usuario) => usuario),
    };
    const service = new UsuariosService(usuarios as any, {} as any, {} as any, {} as any, {} as any, {} as any);

    const resultado = await service.actualizar(1, { activo: true } as any);

    expect(resultado.activo).toBe(true);
    expect(usuarios.save).toHaveBeenCalledWith(expect.objectContaining({ sessionVersion: 3 }));
    expect(resultado).not.toHaveProperty('sessionVersion');
    expect(resultado).not.toHaveProperty('passwordHash');
  });

  it('no devuelve passwordHash al obtener un usuario', async () => {
    const usuarios = { findOne: jest.fn().mockResolvedValue({
      id: 1, email: 'a@escuela.mx', passwordHash: 'secreto', nombre: 'A',
    }) };
    const service = new UsuariosService(usuarios as any, {} as any, {} as any, {} as any, {} as any, {} as any);

    await expect(service.obtener(1)).resolves.not.toHaveProperty('passwordHash');
  });

  it('no devuelve passwordHash al listar usuarios aunque la consulta lo contenga', async () => {
    const usuarios = { findAndCount: jest.fn().mockResolvedValue([[{
      id: 1, email: 'a@escuela.mx', passwordHash: 'hash-privado', nombre: 'A',
      apellidoPaterno: 'B', apellidoMaterno: null, telefono: null, activo: true,
      roles: [], nombreCompleto: 'A B',
    }], 1]) };
    const service = new UsuariosService(usuarios as any, {} as any, {} as any, {} as any, {} as any, {} as any);

    const respuesta = await service.listar({} as any);

    expect(JSON.stringify(respuesta)).not.toContain('hash-privado');
    expect(respuesta.datos[0]).not.toHaveProperty('passwordHash');
  });
});
