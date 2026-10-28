import { validarCambioRolesPersonal } from './jerarquia-roles';
import { RolClave } from './roles.decorator';

const actor = (sub: number, ...roles: string[]) => ({ sub, roles });
const validar = (rolesActor: string[], actuales: string[], solicitados: RolClave[], destino: number | null = 7) =>
  validarCambioRolesPersonal(actor(1, ...rolesActor), destino, actuales, solicitados);

describe('jerarquía de roles institucionales', () => {
  it('permite sumar MAESTRO a FINANZAS por un administrativo', () => {
    expect(() => validar(['ADMINISTRATIVO'], ['FINANZAS'], ['FINANZAS', 'MAESTRO'])).not.toThrow();
  });
  it('permite roles administrativos inferiores al director', () => {
    expect(() => validar(['DIRECTOR'], ['FINANZAS'], ['ADMINISTRATIVO', 'MAESTRO'])).not.toThrow();
  });
  it.each([
    [['ADMINISTRATIVO'], ['FINANZAS'], ['DIRECTOR']],
    [['ADMINISTRATIVO'], ['FINANZAS'], ['SUPERADMIN']],
    [['ADMINISTRATIVO'], ['ADMINISTRATIVO'], ['FINANZAS']],
    [['FINANZAS'], ['MAESTRO'], ['MAESTRO']],
    [['MAESTRO'], [], ['FINANZAS']],
    [['DIRECTOR'], ['SUPERADMIN'], ['MAESTRO']],
  ] as Array<[string[], string[], RolClave[]]>)('rechaza escalamiento o modificación superior: %j', (actorRoles, actuales, solicitados) => {
    expect(() => validar(actorRoles, actuales, solicitados)).toThrow();
  });
  it('rechaza modificación de los roles propios', () => {
    expect(() => validar(['ADMINISTRATIVO'], ['FINANZAS'], ['MAESTRO'], 1)).toThrow();
  });
  it('rechaza combinar ALUMNO y personal', () => {
    expect(() => validar(['ADMINISTRATIVO'], ['ALUMNO'], ['MAESTRO'])).toThrow();
    expect(() => validar(['SUPERADMIN'], [], ['ALUMNO', 'FINANZAS'])).toThrow();
  });
  it('rechaza asignaciones repetidas o vacías', () => {
    expect(() => validar(['ADMINISTRATIVO'], [], [])).toThrow();
    expect(() => validar(['ADMINISTRATIVO'], [], ['MAESTRO', 'MAESTRO'])).toThrow();
  });
  it('permite a SUPERADMIN asignar DIRECTOR, excepto gestionar otra cuenta SUPERADMIN por vía ordinaria', () => {
    expect(() => validar(['SUPERADMIN'], [], ['DIRECTOR'])).not.toThrow();
    expect(() => validar(['SUPERADMIN'], ['SUPERADMIN'], ['DIRECTOR'])).toThrow();
  });
});
