import { ForbiddenException } from '@nestjs/common';
import { JwtUser } from './current-user.decorator';
type Actor = Pick<JwtUser, 'roles'>;
/** Las capacidades se suman por operación: Finanzas nunca concede gestión académica. */
export const puedeAdministrarAcademico = (user: Actor) => user.roles.some((r) => ['SUPERADMIN', 'ADMINISTRATIVO'].includes(r));
export const puedeAdministrarFinanzas = (user: Actor) => user.roles.some((r) => ['SUPERADMIN', 'ADMINISTRATIVO', 'FINANZAS'].includes(r));
export const puedeConsultarAcademico = (user: Actor) => puedeAdministrarAcademico(user) || user.roles.includes('MAESTRO');
export const esMaestroRestringido = (user: Actor) => user.roles.includes('MAESTRO') && !puedeAdministrarAcademico(user);
export const puedeConsultarCalendario = (user: Actor) => puedeConsultarAcademico(user) || user.roles.includes('ALUMNO');
export function exigirConsultaAcademica(user: Actor) {
  if (!puedeConsultarAcademico(user)) throw new ForbiddenException('La operación requiere una capacidad académica');
}
