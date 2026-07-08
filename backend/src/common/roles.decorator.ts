import { SetMetadata } from '@nestjs/common';

export type RolClave = 'ALUMNO' | 'MAESTRO' | 'ADMINISTRATIVO' | 'FINANZAS' | 'SUPERADMIN';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: RolClave[]) => SetMetadata(ROLES_KEY, roles);
