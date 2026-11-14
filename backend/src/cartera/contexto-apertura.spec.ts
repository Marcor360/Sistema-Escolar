import { EntityManager } from 'typeorm';
import { stub } from '../test-utils/stub';
import { validarContextoApertura } from './contexto-apertura';
const base = { plantelId: 3, cicloId: 5, nivelId: 7 };
function escenario(carrera = { id: 9, activo: true, plantelId: 3, nivelId: 7 }, periodo = { id: 11, activo: true, plantelId: 3, carreraId: 9, cicloId: 5 }) {
  const filas = { NivelAcademico: { id: 7, activo: true, plantelId: 3 }, CarreraPlan: carrera, PeriodoAcademico: periodo };
  return stub<EntityManager>({ getRepository: jest.fn((entidad: { name: keyof typeof filas }) => ({ findOne: jest.fn().mockResolvedValue(filas[entidad.name]) })) });
}
it('permite nivel sin plan ni periodo para registrar una apertura pendiente', async () => {
  await expect(validarContextoApertura(escenario(), base)).resolves.toBeUndefined();
});
it('rechaza un periodo sin carrera y una carrera de otro nivel', async () => {
  await expect(validarContextoApertura(escenario(), { ...base, periodoAcademicoId: 11 })).rejects.toThrow('carrera');
  await expect(validarContextoApertura(escenario({ id: 9, activo: true, plantelId: 3, nivelId: 8 }), { ...base, carreraId: 9 })).rejects.toThrow('nivel');
});
it('rechaza periodos de otro plantel o ciclo aunque sus IDs existan', async () => {
  for (const cambio of [{ plantelId: 4 }, { cicloId: 6 }]) {
    const m = escenario(undefined, { id: 11, activo: true, plantelId: 3, carreraId: 9, cicloId: 5, ...cambio });
    await expect(validarContextoApertura(m, { ...base, carreraId: 9, periodoAcademicoId: 11 })).rejects.toThrow('periodo');
  }
});
