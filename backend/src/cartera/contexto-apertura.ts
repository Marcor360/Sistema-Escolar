import { ConflictException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { CarreraPlan, NivelAcademico, PeriodoAcademico } from '../entities';
export interface ContextoApertura {
  plantelId: number; cicloId: number; nivelId: number;
  carreraId?: number | null; periodoAcademicoId?: number | null;
}
/** La apertura puede quedar pendiente; todo catálogo indicado se valida en servidor. */
export async function validarContextoApertura(m: EntityManager, d: ContextoApertura) {
  const nivel = await m.getRepository(NivelAcademico).findOne({ where: { id: d.nivelId }, lock: { mode: 'pessimistic_write' } });
  if (!nivel?.activo || nivel.plantelId !== d.plantelId) throw new ConflictException('Selecciona un nivel académico activo del plantel');
  if (d.periodoAcademicoId && !d.carreraId) throw new ConflictException('Selecciona la carrera o plan del periodo');
  if (d.carreraId) {
    const carrera = await m.getRepository(CarreraPlan).findOne({ where: { id: d.carreraId }, lock: { mode: 'pessimistic_write' } });
    if (!carrera?.activo || carrera.plantelId !== d.plantelId || carrera.nivelId !== d.nivelId) throw new ConflictException('La carrera o plan no corresponde al nivel y plantel');
  }
  if (d.periodoAcademicoId) {
    const periodo = await m.getRepository(PeriodoAcademico).findOne({ where: { id: d.periodoAcademicoId }, lock: { mode: 'pessimistic_write' } });
    if (!periodo?.activo || periodo.plantelId !== d.plantelId || periodo.carreraId !== d.carreraId || periodo.cicloId !== d.cicloId) throw new ConflictException('El periodo no corresponde al plan, plantel y ciclo');
  }
}
export const contextoAperturaCompleto = (d: ContextoApertura): d is ContextoApertura & { carreraId: number; periodoAcademicoId: number } => !!d.carreraId && !!d.periodoAcademicoId;
