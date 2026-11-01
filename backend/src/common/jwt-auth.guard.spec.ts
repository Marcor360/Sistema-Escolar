import { ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ConsentimientoInstitucionalService } from '../auth/consentimiento-institucional.service';

describe.each(['MOVIL', 'WEB'] as const)('Acceso alumno %s con consentimiento pendiente', (portal) => {
  const pendiente = jest.fn().mockResolvedValue(true);
  const guard = new JwtAuthGuard({ pendiente } as unknown as ConsentimientoInstitucionalService);
  const contexto = (path: string, passwordChangeRequired = false) => ({
    switchToHttp: () => ({ getRequest: () => ({ path, user: { sub: 7, roles: ['ALUMNO'], portal, passwordChangeRequired } }) }),
  }) as unknown as ExecutionContext;

  beforeEach(() => {
    pendiente.mockResolvedValue(true);
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
  it.each(['/api/auth/me', '/api/auth/actividad', '/api/auth/logout', '/api/auth/consentimiento'])(
    'permite resolver la aceptación o cerrar sesión: %s', async (path) => {
      await expect(guard.canActivate(contexto(path))).resolves.toBe(true);
      expect(pendiente).not.toHaveBeenCalled();
    },
  );
  it('permite el acceso cuando el servicio no exige aceptación pendiente', async () => {
    pendiente.mockResolvedValueOnce(false);
    await expect(guard.canActivate(contexto('/api/alumnos/me'))).resolves.toBe(true);
  });
});
