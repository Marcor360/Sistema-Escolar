import { ForbiddenException } from '@nestjs/common';
import { RolClave } from './roles.decorator';

type ActorRoles = Readonly<{ sub: number; roles: readonly string[] }>;

const JERARQUIA: Readonly<Record<RolClave, number>> = {
  ALUMNO: 0,
  MAESTRO: 1,
  FINANZAS: 2,
  ADMINISTRATIVO: 3,
  DIRECTOR: 4,
  SUPERADMIN: 5,
};

function nivelMaximo(roles: readonly string[]): number {
  return Math.max(-1, ...roles.map((rol) => JERARQUIA[rol as RolClave] ?? -1));
}

/**
 * La asignación de permisos nunca depende únicamente del botón visible.
 * Verificar adicionalmente los planteles autorizados y el expediente laboral.
 */
export function validarCambioRolesPersonal(
  actor: ActorRoles,
  destinatarioId: number | null,
  rolesActuales: readonly string[],
  rolesSolicitados: readonly RolClave[],
): void {
  if (!rolesSolicitados.length || new Set(rolesSolicitados).size !== rolesSolicitados.length) {
    throw new ForbiddenException('Selecciona roles de personal sin duplicados');
  }
  if (rolesSolicitados.includes('ALUMNO') || rolesActuales.includes('ALUMNO')) {
    throw new ForbiddenException('La identidad de alumno requiere un proceso de vinculación separado');
  }
  if (destinatarioId !== null && destinatarioId === actor.sub) {
    throw new ForbiddenException('No puedes modificar tus propios roles');
  }
  const actorNivel = nivelMaximo(actor.roles);
  if (actorNivel < JERARQUIA.ADMINISTRATIVO) {
    throw new ForbiddenException('No tienes autorización para asignar roles');
  }
  if (rolesActuales.length && nivelMaximo(rolesActuales) >= actorNivel && actorNivel !== JERARQUIA.SUPERADMIN) {
    throw new ForbiddenException('No puedes modificar una cuenta de igual o mayor jerarquía');
  }
  if (nivelMaximo(rolesSolicitados) >= actorNivel && actorNivel !== JERARQUIA.SUPERADMIN) {
    throw new ForbiddenException('No puedes asignar roles de igual o mayor jerarquía');
  }
  if (actorNivel === JERARQUIA.SUPERADMIN && rolesActuales.includes('SUPERADMIN')) {
    throw new ForbiddenException('La gestión de SUPERADMIN requiere el procedimiento protegido');
  }
}
