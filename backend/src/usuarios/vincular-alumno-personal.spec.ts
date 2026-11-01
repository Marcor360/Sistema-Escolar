import type { Repository } from 'typeorm';
import type { Usuario } from '../entities/usuario.entity';
import type { Rol } from '../entities/rol.entity';
import type { Alumno } from '../entities/alumno.entity';
import type { Docente } from '../entities/docente.entity';
import type { UsuarioPlantel } from '../entities/usuario-plantel.entity';
import type { ScopeService } from '../planteles/scope.service';
import { stub } from '../test-utils/stub';
import { UsuariosService } from './usuarios.service';

const actor = { sub: 1, email: 'admin@example.test', nombre: 'Admin', roles: ['ADMINISTRATIVO'], portal: 'WEB' as const };
const dto = {
  alumnoId: 7,
  emailInstitucional: 'empleo@example.test',
  roles: ['FINANZAS'] as Array<'FINANZAS'>,
  motivo: 'Nombramiento institucional aprobado',
  contratacionConfirmada: true as const,
};

function escenario() {
  const estudiante = {
    id: 30, nombre: 'Persona', apellidoPaterno: 'Prueba', apellidoMaterno: null,
    telefono: null, activo: true, roles: [{ clave: 'ALUMNO' }],
  };
  const administrador = { id: 1, activo: true, roles: [{ clave: 'ADMINISTRATIVO' }] };
  const usuarios = {
    findOne: jest.fn(async ({ where }: { where: { id?: number; email?: string } }) =>
      where.id === 1 ? administrador : where.id === 30 ? estudiante : null),
    create: jest.fn((datos: unknown) => datos),
    save: jest.fn(async (datos: Record<string, unknown>) => ({ ...datos, id: 50 })),
    update: jest.fn().mockResolvedValue(undefined),
  };
  const alumno = { findOne: jest.fn().mockResolvedValue({
    id: 7, usuarioId: 30, plantelId: 3, estatus: 'ACTIVO',
  }) };
  const vinculacion = {
    findOneBy: jest.fn().mockResolvedValue(null),
    insert: jest.fn().mockResolvedValue(undefined),
  };
  const asignaciones = { insert: jest.fn().mockResolvedValue(undefined) };
  const roles = { find: jest.fn().mockResolvedValue([{ clave: 'FINANZAS' }]) };
  const bitacora = { insert: jest.fn().mockResolvedValue(undefined) };
  const manager = { getRepository: jest.fn((entidad: { name: string }) => {
    if (entidad.name === 'Usuario') return usuarios;
    if (entidad.name === 'Alumno') return alumno;
    if (entidad.name === 'UsuarioVinculoPersona') return vinculacion;
    if (entidad.name === 'UsuarioPlantel') return asignaciones;
    if (entidad.name === 'Rol') return roles;
    if (entidad.name === 'BitacoraActividad') return bitacora;
    throw new Error('Entidad no simulada');
  }) };
  const scope = { validarGestion: jest.fn().mockResolvedValue(undefined) };
  const servicio = new UsuariosService(
    stub<Repository<Usuario>>({ manager: stub({ transaction: jest.fn(async (fn: (m: unknown) => Promise<unknown>) => fn(manager)) }) }),
    stub<Repository<Rol>>({}), stub<Repository<Alumno>>({}), stub<Repository<Docente>>({}),
    stub<Repository<UsuarioPlantel>>({}), stub<ScopeService>(scope),
  );
  return { servicio, usuarios, alumno, vinculacion, asignaciones, scope, bitacora };
}

describe('vinculación laboral de alumno', () => {
  it('conserva cuenta estudiantil y crea otra identidad para FINANZAS', async () => {
    const { servicio, usuarios, vinculacion, asignaciones, bitacora } = escenario();
    const resultado = await servicio.vincularAlumnoPersonal(dto, actor);
    expect(resultado).toMatchObject({ personalUsuarioId: 50, roles: ['FINANZAS'], activacionPendiente: true });
    expect(usuarios.save).toHaveBeenCalledTimes(1);
    expect(vinculacion.insert).toHaveBeenCalledWith(expect.objectContaining({
      alumnoUsuarioId: 30, personalUsuarioId: 50, autorizadoPorId: 1,
    }));
    expect(asignaciones.insert).toHaveBeenCalledWith(expect.objectContaining({ plantelId: 3 }));
    expect(bitacora.insert).toHaveBeenCalled();
  });
  it('rechaza un responsable de FINANZAS', async () => {
    const { servicio, usuarios } = escenario();
    usuarios.findOne.mockResolvedValueOnce({ id: 1, activo: true, roles: [{ clave: 'FINANZAS' }] });
    await expect(servicio.vincularAlumnoPersonal(dto, { ...actor, roles: ['FINANZAS'] })).rejects.toThrow();
  });
  it('rechaza alumnos ya vinculados antes de crear una cuenta', async () => {
    const { servicio, vinculacion, usuarios } = escenario();
    vinculacion.findOneBy.mockResolvedValueOnce({ id: 9 });
    await expect(servicio.vincularAlumnoPersonal(dto, actor)).rejects.toThrow('ya tiene');
    expect(usuarios.save).not.toHaveBeenCalled();
  });
  it('rechaza peticiones desde Expo', async () => {
    const { servicio } = escenario();
    await expect(servicio.vincularAlumnoPersonal(dto, { ...actor, portal: 'MOVIL' })).rejects.toThrow();
  });
});
