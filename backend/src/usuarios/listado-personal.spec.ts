import type { Repository } from 'typeorm';
import type { Usuario } from '../entities/usuario.entity';
import type { Rol } from '../entities/rol.entity';
import type { Alumno } from '../entities/alumno.entity';
import type { Docente } from '../entities/docente.entity';
import type { UsuarioPlantel } from '../entities/usuario-plantel.entity';
import type { ScopeService } from '../planteles/scope.service';
import type { ListadoUsuariosDto } from './usuarios.dto';
import type { JwtUser } from '../common/current-user.decorator';
import { stub } from '../test-utils/stub';
import { UsuariosService } from './usuarios.service';

function escenario() {
  const qb: Record<string, jest.Mock> = {};
  for (const nombre of ['innerJoin', 'leftJoinAndSelect', 'distinct', 'andWhere', 'orderBy', 'skip', 'take']) {
    qb[nombre] = jest.fn().mockReturnValue(qb);
  }
  qb.getManyAndCount = jest.fn().mockResolvedValue([[], 0]);
  const usuarios = { createQueryBuilder: jest.fn().mockReturnValue(qb) };
  const scope = { resolverFiltro: jest.fn().mockResolvedValue([3]) };
  const service = new UsuariosService(
    stub<Repository<Usuario>>(usuarios),
    stub<Repository<Rol>>({}),
    stub<Repository<Alumno>>({}),
    stub<Repository<Docente>>({}),
    stub<Repository<UsuarioPlantel>>({}),
    stub<ScopeService>(scope),
  );
  const listado = (tipo: ListadoUsuariosDto['tipo'], roles: string[]) =>
    service.listado(stub<ListadoUsuariosDto>({ tipo, pagina: 1, porPagina: 10 }),
      stub<JwtUser>({ sub: 1, nombre: 'Usuario de prueba', email: 'usuario@example.test', roles }));
  return { service, listado, qb, scope };
}

describe('selector de funciones del personal', () => {
  it('incluye cuentas con solo MAESTRO sin alterar los demás listados', async () => {
    const { listado, qb, scope } = escenario();
    await listado('PERSONAL', ['ADMINISTRATIVO']);
    expect(qb.innerJoin).toHaveBeenCalledWith(
      'u.roles', 'rolFiltro', 'rolFiltro.clave IN (:...staff)',
      expect.objectContaining({
        staff: expect.arrayContaining(['MAESTRO', 'ADMINISTRATIVO', 'FINANZAS', 'DIRECTOR', 'SUPERADMIN']),
      }),
    );
    expect(scope.resolverFiltro).toHaveBeenCalled();
    expect(qb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('usuario_planteles'),
      expect.objectContaining({ planteles: [3] }),
    );
  });

  it('mantiene fuera a MAESTRO del listado administrativo ordinario', async () => {
    const { listado, qb } = escenario();
    await listado('ADMINISTRATIVO', ['ADMINISTRATIVO']);
    const filtro = qb.innerJoin.mock.calls[0][3] as { staff: string[] };
    expect(filtro.staff).not.toContain('MAESTRO');
  });

  it.each([['MAESTRO'], ['FINANZAS'], ['ALUMNO']])(
    'impide consultar la selección de funciones con rol insuficiente: %j',
    async (roles) => {
      const { listado, qb } = escenario();
      await expect(listado('PERSONAL', roles)).rejects.toThrow();
      expect(qb.innerJoin).not.toHaveBeenCalled();
    },
  );
});
