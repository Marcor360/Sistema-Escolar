import type { ScopeService } from '../planteles/scope.service';
import type { EntityManager } from 'typeorm';
import { stub } from '../test-utils/stub';
import { ForbiddenException } from '@nestjs/common';
import { AgrupacionRegularService, ContextoRegular } from './agrupacion-regular.service';
import { JwtUser } from '../common/current-user.decorator';

const dto = { alumnoId: 1, plantelId: 2 } as ContextoRegular;
const finanzas = { sub: 3, roles: ['FINANZAS'] } as JwtUser;

describe('Permisos de agrupación al reinscribir', () => {
  it('mantiene la apertura ordinaria reservada a Control Escolar', async () => {
    const scope = { validarGestion: jest.fn() };
    const service = new AgrupacionRegularService(stub<ScopeService>(scope));
    await expect(service.solicitar(stub<EntityManager>({}), dto, finanzas)).rejects.toThrow('Control Escolar');
    expect(scope.validarGestion).not.toHaveBeenCalled();
  });
  it('la reinscripción de Finanzas sigue exigiendo autorización del plantel', async () => {
    const scope = { validarGestion: jest.fn().mockRejectedValue(new ForbiddenException('Plantel ajeno')) };
    const service = new AgrupacionRegularService(stub<ScopeService>(scope));
    await expect(service.solicitar(stub<EntityManager>({}), dto, finanzas, true)).rejects.toThrow('Plantel ajeno');
    expect(scope.validarGestion).toHaveBeenCalledWith(finanzas, 2);
  });
  it('la excepción de reinscripción no habilita otros roles', async () => {
    const scope = { validarGestion: jest.fn() };
    const service = new AgrupacionRegularService(stub<ScopeService>(scope));
    await expect(
      service.solicitar(stub<EntityManager>({}), dto, { ...finanzas, roles: ['MAESTRO'] }, true),
    ).rejects.toThrow('Control Escolar');
    expect(scope.validarGestion).not.toHaveBeenCalled();
  });
});
