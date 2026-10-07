import { ConflictException } from '@nestjs/common';
import { Grupo } from '../entities/grupo.entity';

/** Operación vigente; el histórico siempre se consulta con ciclo explícito. */
export function grupoVigente(grupo: Grupo): boolean {
  return grupo.activo && grupo.ciclo?.activo === true && grupo.plantel?.activo === true;
}

export function exigirGrupoVigente(grupo: Grupo): void {
  if (!grupoVigente(grupo)) throw new ConflictException('El grupo, ciclo y plantel deben estar activos');
}

export const inscripcionVigente = {
  estatus: 'ACTIVA' as const,
  alumno: { estatus: 'ACTIVO' as const, usuario: { activo: true } },
  grupo: { activo: true, ciclo: { activo: true }, plantel: { activo: true } },
};

/** Configuración del siguiente ciclo sin habilitar todavía operación académica. */
export function exigirGrupoConfigurable(grupo: Grupo): void {
  if (!grupo.activo || !grupo.plantel?.activo || !['PREPARACION', 'ACTIVO'].includes(grupo.ciclo.estado)) throw new ConflictException('El grupo y plantel deben estar activos y el ciclo en preparación o activo');
}
