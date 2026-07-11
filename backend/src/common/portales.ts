import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RolClave } from './roles.decorator';

export type Portal = 'WEB' | 'MOVIL';

export const ROLES_POR_PORTAL: Record<Portal, RolClave[]> = {
  WEB: ['MAESTRO', 'ADMINISTRATIVO', 'FINANZAS', 'SUPERADMIN'],
  MOVIL: ['ALUMNO'],
};

export const MENSAJES_PORTAL: Record<Portal, string> = {
  WEB: 'Tu cuenta es de alumno. Ingresa desde la app móvil de la escuela.',
  MOVIL: 'Esta app es solo para alumnos. El personal ingresa por el portal web.',
};

export const PortalActual = createParamDecorator((_: unknown, ctx: ExecutionContext): Portal => {
  const valor = String(ctx.switchToHttp().getRequest().headers['x-portal'] ?? 'WEB').toUpperCase();
  return valor === 'MOVIL' ? 'MOVIL' : 'WEB';
});
