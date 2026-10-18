import { ConflictException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { CarreraPlan, NivelAcademico, PeriodoAcademico } from '../entities';

export interface ContextoGrupo {
  plantelId: number; cicloId: number;
  nivelId?: number | null; carreraId?: number | null; periodoAcademicoId?: number | null;
}
/** Los históricos sin contexto permanecen válidos; un contexto nuevo debe estar completo. */
export async function validarContextoGrupo(manager: EntityManager, grupo: ContextoGrupo): Promise<void> {
  const { nivelId, carreraId, periodoAcademicoId } = grupo;
  if (nivelId == null && carreraId == null && periodoAcademicoId == null) return;
  if (!nivelId || !carreraId || !periodoAcademicoId) throw new ConflictException('Selecciona nivel, carrera/plan y periodo completos');
  const nivel = await manager.getRepository(NivelAcademico).findOne({ where: { id: nivelId }, lock: { mode: 'pessimistic_write' } });
  const carrera = await manager.getRepository(CarreraPlan).findOne({ where: { id: carreraId }, lock: { mode: 'pessimistic_write' } });
  const periodo = await manager.getRepository(PeriodoAcademico).findOne({ where: { id: periodoAcademicoId }, lock: { mode: 'pessimistic_write' } });
  if (!nivel?.activo || !carrera?.activo || !periodo?.activo ||
      nivel.plantelId !== grupo.plantelId || carrera.plantelId !== grupo.plantelId || periodo.plantelId !== grupo.plantelId ||
      carrera.nivelId !== nivelId || periodo.carreraId !== carreraId || periodo.cicloId !== grupo.cicloId) {
    throw new ConflictException('Nivel, carrera/plan y periodo deben estar activos y ser compatibles con plantel y ciclo');
  }
}
