import { ForbiddenException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ScopeService } from './scope.service';
import { UsuarioPlantel } from '../entities/usuario-plantel.entity';
import { JwtUser } from '../common/current-user.decorator';

const usuario = (roles: string[], sub = 17): JwtUser => ({
  sub,
  email: 'prueba@example.test',
  nombre: 'Prueba',
  roles,
});

const preparar = (planteles: number[]) => {
  const find = jest.fn().mockResolvedValue(
    planteles.map((plantelId) => ({ usuarioId: 17, plantelId, activo: true })),
  );
  const repo = { find } as unknown as Repository<UsuarioPlantel>;
  return { scope: new ScopeService(repo), find };
};

describe('Regresión de permisos por plantel', () => {
  it.each(['ADMINISTRATIVO', 'MAESTRO', 'FINANZAS', 'ALUMNO'])(
    'rechaza acceder a un plantel ajeno para %s',
    async (rol) => {
      const { scope } = preparar([1, 3]);
      await expect(scope.resolverFiltro(usuario([rol]), 2)).rejects.toBeInstanceOf(ForbiddenException);
    },
  );

  it('no permite operar si no tiene asignaciones', async () => {
    const { scope } = preparar([]);
    await expect(scope.resolverFiltro(usuario(['ADMINISTRATIVO']))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(scope.validarGestion(usuario(['ADMINISTRATIVO']), 1)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('limita filtros sin plantel a los planteles activos asignados', async () => {
    const { scope, find } = preparar([1, 3]);
    await expect(scope.resolverFiltro(usuario(['MAESTRO']))).resolves.toEqual([1, 3]);
    expect(find).toHaveBeenCalledWith({
      where: { usuarioId: 17, activo: true },
      select: { plantelId: true },
      loadEagerRelations: false,
    });
  });

  it('permite gestionar únicamente el plantel autorizado', async () => {
    const { scope } = preparar([3]);
    await expect(scope.validarGestion(usuario(['ADMINISTRATIVO']), 3)).resolves.toEqual([3]);
  });

  it.each([null, undefined, 0])('rechaza la gestión sin plantel válido (%s)', async (id) => {
    const { scope } = preparar([1]);
    await expect(scope.validarGestion(usuario(['ADMINISTRATIVO']), id)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('SUPERADMIN puede consultar todos o filtrar un plantel', async () => {
    const { scope, find } = preparar([]);
    await expect(scope.resolverFiltro(usuario(['SUPERADMIN']))).resolves.toBeNull();
    await expect(scope.resolverFiltro(usuario(['SUPERADMIN']), 4)).resolves.toEqual([4]);
    expect(find).not.toHaveBeenCalled();
  });
});
