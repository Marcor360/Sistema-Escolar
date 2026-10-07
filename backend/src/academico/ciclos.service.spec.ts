import { Grupo } from '../entities/grupo.entity';
import { DataSource, EntityManager } from 'typeorm';
import { CiclosService } from './ciclos.service';
import { CicloEscolar } from '../entities/ciclo-escolar.entity';
import { GrupoMateria } from '../entities/grupo-materia.entity';
import { Inscripcion } from '../entities/inscripcion.entity';
import { Calificacion } from '../entities/calificacion.entity';
import { PeriodoCalificacion } from '../entities/periodo-calificacion.entity';
import { BitacoraAcademica } from '../entities/bitacora-academica.entity';
const user = { sub: 1, email: 's@example.invalid', nombre: 'Super', roles: ['SUPERADMIN'] };
function entorno({ falta = false, abierto = false } = {}) {
  const ciclo = { id: 1, activo: true, estado: 'EN_CIERRE' };
  const ciclos = { findOneBy: jest.fn().mockResolvedValue(ciclo), findOne: jest.fn().mockResolvedValue(ciclo), save: jest.fn() };
  const notas = [1, 2, 3].filter((p) => !falta || p !== 3).map((p) => ({ grupoMateriaId: 5, alumnoId: 7, parcial: p }));
  const periodos = [1, 2, 3].map((p) => ({ grupoMateriaId: 5, parcial: p, estatus: abierto && p === 2 ? 'ABIERTO' : 'CERRADO' }));
  const audit = { insert: jest.fn() };
  const repos = new Map<unknown, unknown>([[Grupo, { find: jest.fn().mockResolvedValue([{ id: 4 }]) }], [CicloEscolar, ciclos], [GrupoMateria, { find: jest.fn().mockResolvedValue([{ id: 5, grupoId: 4 }]) }], [Inscripcion, { find: jest.fn().mockResolvedValue([{ grupoId: 4, alumnoId: 7 }]) }], [Calificacion, { find: jest.fn().mockResolvedValue(notas) }], [PeriodoCalificacion, { find: jest.fn().mockResolvedValue(periodos) }], [BitacoraAcademica, audit]]);
  const manager = { getRepository: (t: unknown) => repos.get(t) } as unknown as EntityManager;
  const ds = { transaction: (isolation: unknown, fn?: (m: EntityManager) => Promise<unknown>) => fn ? fn(manager) : (isolation as (m: EntityManager) => Promise<unknown>)(manager) } as unknown as DataSource;
  return { service: new CiclosService(ds), ciclos, audit };
}
it.each([{ falta: true }, { abierto: true }])('rechaza cierre con notas faltantes o parcial abierto: %j', async (config) => { const { service, ciclos, audit } = entorno(config); await expect(service.transicion(1, 'cerrar', true, user)).rejects.toThrow('faltantes'); expect(ciclos.save).not.toHaveBeenCalled(); expect(audit.insert).not.toHaveBeenCalled(); });
it('cierra únicamente después de completar y cerrar P1-P3', async () => { const { service, audit } = entorno(); await expect(service.transicion(1, 'cerrar', true, user)).resolves.toMatchObject({ activo: false, estado: 'CERRADO' }); expect(audit.insert).toHaveBeenCalledWith(expect.objectContaining({ usuarioId: 1, accion: 'CICLO_CERRAR' })); });
