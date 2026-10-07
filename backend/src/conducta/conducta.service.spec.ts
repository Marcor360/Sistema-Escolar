import { DataSource } from 'typeorm';
import { ScopeService } from '../planteles/scope.service';
import { ConductaService } from './conducta.service';
import { Grupo } from '../entities/grupo.entity';
import { GrupoMateria } from '../entities/grupo-materia.entity';
import { Incidencia } from '../entities/incidencia.entity';
import { IncidenciaSeguimiento } from '../entities/incidencia-seguimiento.entity';
const docente = { sub: 1, email: 'm@example.invalid', nombre: 'Maestro', roles: ['MAESTRO'] as const };
function entorno() {
  const transaccion = jest.fn(); const grupos = { findOneBy: jest.fn().mockResolvedValue({ id: 1, plantelId: 5 }) };
  const clases = { find: jest.fn().mockResolvedValue([{ grupoId: 1 }]) };
  const incidencias = { findOneBy: jest.fn().mockResolvedValue({ id: 2, grupoId: 1 }) };
  const seguimientos = { find: jest.fn().mockResolvedValue([]) };
  const repos = new Map<unknown, unknown>([[Grupo, grupos], [GrupoMateria, clases], [Incidencia, incidencias], [IncidenciaSeguimiento, seguimientos]]);
  const ds = { getRepository: (t: unknown) => repos.get(t), transaction: transaccion } as unknown as DataSource;
  const scope = { validarGestion: jest.fn(), resolverFiltro: jest.fn().mockResolvedValue([5]) } as unknown as ScopeService;
  return { service: new ConductaService(ds, scope), clases, transaccion };
}
it('impide consultar el grupo de otro maestro', async () => { const { service, clases } = entorno(); clases.find.mockResolvedValue([{ grupoId: 3 }]); await expect(service.detalle(2, { ...docente, roles: ['MAESTRO'] })).rejects.toThrow('fuera de tus grupos'); });
it('el maestro no puede cerrar ni anular; control escolar sí conserva el flujo', async () => { const { service, transaccion } = entorno(); await expect(service.seguir(2, { nota: 'Nota', motivo: 'Motivo', estado: 'ANULADA' }, { ...docente, roles: ['MAESTRO'] })).rejects.toThrow('control escolar'); expect(transaccion).not.toHaveBeenCalled(); });
