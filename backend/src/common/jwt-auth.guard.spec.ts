import { ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ConsentimientoInstitucionalService } from '../auth/consentimiento-institucional.service';

describe('Acceso móvil con consentimiento pendiente', () => {
  const pendiente = jest.fn().mockResolvedValue(true);
  const guard = new JwtAuthGuard({ pendiente } as unknown as ConsentimientoInstitucionalService);
  const contexto = (path: string, passwordChangeRequired = false) => ({
    switchToHttp: () => ({ getRequest: () => ({ path, user: { sub: 7, roles: ['ALUMNO'], portal: 'MOVIL', passwordChangeRequired } }) }),
  }) as unknown as ExecutionContext;

  beforeEach(() => {
    jest.spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate').mockResolvedValue(true);
    pendiente.mockClear();
  });
  afterEach(() => jest.restoreAllMocks());

  it('permite cambiar la contraseña temporal antes de aceptar los documentos', async () => {
    await expect(guard.canActivate(contexto('/api/auth/cambiar-password', true))).resolves.toBe(true);
    expect(pendiente).not.toHaveBeenCalled();
  });

  it('mantiene bloqueados los recursos del alumno hasta que acepte', async () => {
    await expect(guard.canActivate(contexto('/api/alumnos/me'))).rejects.toThrow('CONSENTIMIENTO_INSTITUCIONAL_PENDIENTE');
    expect(pendiente).toHaveBeenCalled();
  });
});
