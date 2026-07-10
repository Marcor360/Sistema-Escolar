import { ForbiddenException } from '@nestjs/common';
import { ScopeService } from './scope.service';
import { JwtUser } from '../common/current-user.decorator';

const user = (roles: string[] = ['ADMINISTRATIVO']): JwtUser => ({
  sub: 10,
  email: 'u@escuela.mx',
  nombre: 'Usuario',
  roles,
});

describe('ScopeService', () => {
  it('devuelve null para SUPERADMIN', async () => {
    const service = new ScopeService({ find: jest.fn() } as any);
    await expect(service.plantelesDe(user(['SUPERADMIN']))).resolves.toBeNull();
  });

  it('devuelve planteles asignados del usuario', async () => {
    const repo = { find: jest.fn().mockResolvedValue([{ plantelId: 1 }, { plantelId: 3 }]) };
    const service = new ScopeService(repo as any);
    await expect(service.plantelesDe(user())).resolves.toEqual([1, 3]);
    expect(repo.find).toHaveBeenCalledWith({ where: { usuarioId: 10, activo: true } });
  });

  it('resolverFiltro rechaza plantel fuera de alcance', async () => {
    const repo = { find: jest.fn().mockResolvedValue([{ plantelId: 1 }]) };
    const service = new ScopeService(repo as any);
    await expect(service.resolverFiltro(user(), 2)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
