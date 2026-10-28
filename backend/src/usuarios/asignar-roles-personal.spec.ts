import type { Repository } from 'typeorm';
import type { Usuario } from '../entities/usuario.entity';
import type { Rol } from '../entities/rol.entity';
import type { Alumno } from '../entities/alumno.entity';
import type { Docente } from '../entities/docente.entity';
import type { UsuarioPlantel } from '../entities/usuario-plantel.entity';
import type { ScopeService } from '../planteles/scope.service';
import { stub } from '../test-utils/stub';
import { UsuariosService } from './usuarios.service';

function escenario(actorRoles: string[], destinoRoles: string[], plantelesDestino = [3]) {
  const actor = { id: 1, activo: true, roles: actorRoles.map((clave) => ({ clave })) };
  const destino = { id: 7, activo: true, sessionVersion: 1, roles: destinoRoles.map((clave) => ({ clave })) };
  const usuarios = {
    findOne: jest.fn(async ({ where }: { where: { id: number } }) => where.id === 1 ? actor : destino),
    save: jest.fn(async (valor: unknown) => valor),
  };
  const asignaciones = {
    find: jest.fn(async ({ where }: { where: { usuarioId: number } }) =>
      (where.usuarioId === 1 ? [3] : plantelesDestino).map((plantelId) => ({ plantelId }))),
  };
  const roles = { find: jest.fn(async ({ where }: { where: { clave: { value: string[] } } }) =>
    where.clave.value.map((clave) => ({ clave }))) };
  const docente = { findOne: jest.fn().mockResolvedValue({ id: 22, estatus: 'ACTIVO' }) };
  const bitacora = { insert: jest.fn().mockResolvedValue(undefined) };
  const manager = { getRepository: jest.fn((entidad: { name: string }) => {
    if (entidad.name === 'Usuario') return usuarios;
    if (entidad.name === 'UsuarioPlantel') return asignaciones;
    if (entidad.name === 'Rol') return roles;
    if (entidad.name === 'Docente') return docente;
    if (entidad.name === 'BitacoraActividad') return bitacora;
    throw new Error('Repositorio inesperado');
  }) };
  const service = new UsuariosService(
    stub<Repository<Usuario>>({ manager: stub({ transaction: jest.fn(async (fn: (m: unknown) => Promise<unknown>) => fn(manager)) }) }),
    stub<Repository<Rol>>({}),
    stub<Repository<Alumno>>({}),
    stub<Repository<Docente>>({}),
    stub<Repository<UsuarioPlantel>>({}),
    stub<ScopeService>({}),
  );
  return { service, usuarios, bitacora };
}

describe('asignación jerárquica de roles', () => {
  it('rechaza que ADMINISTRATIVO conceda DIRECTOR', async () => {
    const { service, usuarios } = escenario(['ADMINISTRATIVO'], ['FINANZAS']);
    await expect(service.asignarRolesPersonal(7, ['DIRECTOR'], { sub: 1, roles: ['ADMINISTRATIVO'], email: '', nombre: '' })).rejects.toThrow();
    expect(usuarios.save).not.toHaveBeenCalled();
  });
  it('rechaza si el destinatario está fuera del plantel del actor', async () => {
    const { service, usuarios } = escenario(['ADMINISTRATIVO'], ['FINANZAS'], [9]);
    await expect(service.asignarRolesPersonal(7, ['FINANZAS'], { sub: 1, roles: ['ADMINISTRATIVO'], email: '', nombre: '' })).rejects.toThrow();
    expect(usuarios.save).not.toHaveBeenCalled();
  });
  it('rechaza añadir MAESTRO sin tramitar antes su expediente docente', async () => {
    const { service } = escenario(['ADMINISTRATIVO'], ['FINANZAS']);
    await expect(service.asignarRolesPersonal(7, ['FINANZAS', 'MAESTRO'], { sub: 1, roles: ['ADMINISTRATIVO'], email: '', nombre: '' })).rejects.toThrow('expediente de Docentes');
  });
  it('impide cambios desde portal móvil', async () => {
    const { service } = escenario(['ADMINISTRATIVO'], ['FINANZAS']);
    await expect(service.asignarRolesPersonal(7, ['FINANZAS'], { sub: 1, roles: ['ADMINISTRATIVO'], email: '', nombre: '', portal: 'MOVIL' })).rejects.toThrow();
  });
  it('revoca sesiones y audita cuando actualiza roles de personal válido', async () => {
    const { service, usuarios, bitacora } = escenario(['ADMINISTRATIVO'], ['FINANZAS']);
    const resultado = await service.asignarRolesPersonal(7, ['FINANZAS'], { sub: 1, roles: ['ADMINISTRATIVO'], email: '', nombre: '' });
    expect(resultado.sesionesRevocadas).toBe(true);
    expect(usuarios.save).toHaveBeenCalledWith(expect.objectContaining({ sessionVersion: 2 }));
    expect(bitacora.insert).toHaveBeenCalled();
  });
});
