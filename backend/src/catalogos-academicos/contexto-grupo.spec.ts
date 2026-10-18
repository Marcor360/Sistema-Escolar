import { validarContextoGrupo } from './contexto-grupo';
import { EntityManager } from 'typeorm';
import { CarreraPlan, NivelAcademico, PeriodoAcademico } from '../entities';
const grupo = { plantelId: 1, cicloId: 4, nivelId: 2, carreraId: 3, periodoAcademicoId: 5 };
function manager(cambio: Partial<{ nivelPlantel: number; carreraNivel: number; periodoCarrera: number; periodoCiclo: number; activo: boolean }> = {}) {
  return { getRepository: (entidad: unknown) => ({ findOne: async () => entidad === NivelAcademico ? { id: 2, plantelId: cambio.nivelPlantel ?? 1, activo: cambio.activo ?? true }
    : entidad === CarreraPlan ? { id: 3, plantelId: 1, nivelId: cambio.carreraNivel ?? 2, activo: true }
    : entidad === PeriodoAcademico ? { id: 5, plantelId: 1, carreraId: cambio.periodoCarrera ?? 3, cicloId: cambio.periodoCiclo ?? 4, activo: true } : null }) } as unknown as EntityManager;
}
it('conserva históricos sin contexto y valida cohortes completas', async () => {
  await expect(validarContextoGrupo(manager(), { plantelId: 1, cicloId: 4 })).resolves.toBeUndefined();
  await expect(validarContextoGrupo(manager(), grupo)).resolves.toBeUndefined();
});
it.each([{ nivelPlantel: 9 }, { carreraNivel: 9 }, { periodoCarrera: 9 }, { periodoCiclo: 9 }, { activo: false }])('rechaza contextos incompatibles: %j', async (cambio) => {
  await expect(validarContextoGrupo(manager(cambio), grupo)).rejects.toThrow('compatibles');
});
it('rechaza contexto parcial', async () => {
  await expect(validarContextoGrupo(manager(), { plantelId: 1, cicloId: 4, nivelId: 2 })).rejects.toThrow('completos');
});
