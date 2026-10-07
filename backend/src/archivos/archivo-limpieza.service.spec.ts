import { DataSource, EntityManager } from 'typeorm';
import { unlink } from 'fs/promises';
import { ArchivoLimpiezaService, programarLimpieza } from './archivo-limpieza.service';
jest.mock('fs/promises', () => ({ unlink: jest.fn() }));
const borrar = jest.mocked(unlink);
function entorno() {
  const fila = { id: 1, nombre: 'archivo.txt', proximoIntento: new Date(0), intentos: 0 };
  const repo = { find: jest.fn().mockResolvedValue([fila]), findOne: jest.fn().mockResolvedValue(fila), update: jest.fn(), delete: jest.fn(), existsBy: jest.fn().mockResolvedValue(false), insert: jest.fn() };
  const manager = { getRepository: () => repo } as unknown as EntityManager;
  const ds = { getRepository: manager.getRepository, transaction: (fn: (m: EntityManager) => Promise<unknown>) => fn(manager) } as unknown as DataSource;
  return { service: new ArchivoLimpiezaService(ds), repo, manager };
}
beforeEach(() => borrar.mockReset());
it('persiste únicamente nombres locales seguros sin traversal', async () => { const { manager, repo } = entorno(); await programarLimpieza(manager, '/uploads/archivo.txt'); expect(repo.insert).toHaveBeenCalledWith(expect.objectContaining({ nombre: 'archivo.txt', intentos: 0 })); await programarLimpieza(manager, '/uploads/../otro'); await programarLimpieza(manager, '/uploads/..'); expect(repo.insert).toHaveBeenCalledTimes(1); });
it('un fallo de permisos conserva la referencia y programa reintento', async () => { borrar.mockRejectedValue(Object.assign(new Error('sin permiso'), { code: 'EACCES' })); const { service, repo } = entorno(); await service.procesar(); expect(repo.delete).not.toHaveBeenCalled(); expect(repo.update).toHaveBeenCalledWith(1, expect.objectContaining({ intentos: 1, error: 'ALMACENAMIENTO_NO_DISPONIBLE' })); });
it.each([undefined, 'ENOENT'])('retira la cola si el archivo se eliminó o ya no existe: %s', async (codigo) => { if (codigo) borrar.mockRejectedValue(Object.assign(new Error('ausente'), { code: codigo })); else borrar.mockResolvedValue(undefined); const { service, repo } = entorno(); await service.procesar(); expect(repo.delete).toHaveBeenCalledWith(1); expect(repo.update).not.toHaveBeenCalled(); });
