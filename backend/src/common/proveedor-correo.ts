import type { ProveedorCorreo } from '../entities/usuario.entity';

/** Un alumno recibe por defecto desde Microsoft; todo el personal desde GoDaddy. */
export function proveedorCorreoPredeterminado(roles: readonly string[]): ProveedorCorreo {
  return roles.includes('ALUMNO') ? 'MICROSOFT365' : 'GODADDY';
}
