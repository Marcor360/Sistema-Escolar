import type { Repository } from 'typeorm';
import type { Usuario } from '../entities/usuario.entity';
import type { Rol } from '../entities/rol.entity';
import type { Alumno } from '../entities/alumno.entity';
import type { Docente } from '../entities/docente.entity';
import type { UsuarioPlantel } from '../entities/usuario-plantel.entity';
import type { ScopeService } from '../planteles/scope.service';
import type { ListadoUsuariosDto, ActualizarUsuarioDto } from './usuarios.dto';
import type { PaginacionDto } from '../common/paginacion.dto';
import { stub } from '../test-utils/stub';
import { UsuariosService } from './usuarios.service';
import { JwtUser } from '../common/current-user.decorator';

function crearQb() {
  const qb: Record<string, jest.Mock> = {};
  ['innerJoinAndSelect', 'leftJoinAndSelect', 'andWhere', 'orderBy', 'skip', 'take'].forEach((metodo) => {
    qb[metodo] = jest.fn().mockReturnValue(qb);
  });
  qb.getManyAndCount = jest.fn().mockResolvedValue([[], 0]);
  return qb;
}

describe('UsuariosService.listado — alcance de alumnos por rol', () => {
  it('un maestro puro aplica la subconsulta EXISTS de inscripciones/grupo_materias/docentes', async () => {
    const qb = crearQb();
    const alumnosRepo = { createQueryBuilder: jest.fn().mockReturnValue(qb) };
    const scope = { resolverFiltro: jest.fn() };
    const service = new UsuariosService(
      stub<Repository<Usuario>>({}),
      stub<Repository<Rol>>({}),
      stub<Repository<Alumno>>(alumnosRepo),
      stub<Repository<Docente>>({}),
      stub<Repository<UsuarioPlantel>>({}),
      stub<ScopeService>(scope),
    );
    const user: JwtUser = { sub: 9, email: 'm@escuela.mx', nombre: 'Maestro', roles: ['MAESTRO'] };

    await service.listado(stub<ListadoUsuariosDto>({ tipo: 'ALUMNO', pagina: 1, porPagina: 20 }), user);

    expect(qb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('EXISTS'),
      expect.objectContaining({ actorId: 9 }),
    );
    expect(scope.resolverFiltro).not.toHaveBeenCalled();
  });

  it('un ADMINISTRATIVO no aplica la subconsulta EXISTS; usa el alcance de planteles', async () => {
    const qb = crearQb();
    const alumnosRepo = { createQueryBuilder: jest.fn().mockReturnValue(qb) };
    const scope = { resolverFiltro: jest.fn().mockResolvedValue(null) };
    const service = new UsuariosService(
      stub<Repository<Usuario>>({}),
      stub<Repository<Rol>>({}),
      stub<Repository<Alumno>>(alumnosRepo),
      stub<Repository<Docente>>({}),
      stub<Repository<UsuarioPlantel>>({}),
      stub<ScopeService>(scope),
    );
    const user: JwtUser = { sub: 3, email: 'a@escuela.mx', nombre: 'Admin', roles: ['ADMINISTRATIVO'] };

    await service.listado(stub<ListadoUsuariosDto>({ tipo: 'ALUMNO', pagina: 1, porPagina: 20 }), user);

    expect(scope.resolverFiltro).toHaveBeenCalledWith(user, undefined);
    const llamadasExists = qb.andWhere.mock.calls.filter(
      ([sql]: [string]) => typeof sql === 'string' && sql.includes('EXISTS'),
    );
    expect(llamadasExists).toHaveLength(0);
  });
});

describe('UsuariosService.actualizar revoca sesiones', () => {
  it('invalida los tokens previos al reactivar una cuenta desactivada', async () => {
    const cuenta = {
      id: 1,
      email: 'a@escuela.mx',
      passwordHash: 'hash',
      nombre: 'A',
      apellidoPaterno: 'B',
      apellidoMaterno: null as string | null,
      telefono: null as string | null,
      activo: false,
      sessionVersion: 2,
      roles: [] as string[],
    };
    const usuarios = {
      findOne: jest.fn().mockResolvedValue(cuenta),
      save: jest.fn(async (usuario) => usuario),
    };
    const manager = { getRepository: jest.fn(() => usuarios) };
    Object.assign(usuarios, { manager: { transaction: jest.fn(async (cb) => cb(manager)) } });
    const service = new UsuariosService(
      stub<Repository<Usuario>>(usuarios),
      stub<Repository<Rol>>({}),
      stub<Repository<Alumno>>({}),
      stub<Repository<Docente>>({}),
      stub<Repository<UsuarioPlantel>>({}),
      stub<ScopeService>({}),
    );

    const resultado = await service.actualizar(1, stub<ActualizarUsuarioDto>({ activo: true }));

    expect(resultado.activo).toBe(true);
    expect(usuarios.save).toHaveBeenCalledWith(expect.objectContaining({ sessionVersion: 3 }));
    expect(resultado).not.toHaveProperty('sessionVersion');
    expect(resultado).not.toHaveProperty('passwordHash');
  });

  it('no devuelve passwordHash al obtener un usuario', async () => {
    const usuarios = {
      findOne: jest.fn().mockResolvedValue({
        id: 1,
        email: 'a@escuela.mx',
        passwordHash: 'secreto',
        nombre: 'A',
      }),
    };
    const service = new UsuariosService(
      stub<Repository<Usuario>>(usuarios),
      stub<Repository<Rol>>({}),
      stub<Repository<Alumno>>({}),
      stub<Repository<Docente>>({}),
      stub<Repository<UsuarioPlantel>>({}),
      stub<ScopeService>({}),
    );

    await expect(service.obtener(1)).resolves.not.toHaveProperty('passwordHash');
  });

  it('no devuelve passwordHash al listar usuarios aunque la consulta lo contenga', async () => {
    const usuarios = {
      findAndCount: jest.fn().mockResolvedValue([
        [
          {
            id: 1,
            email: 'a@escuela.mx',
            passwordHash: 'hash-privado',
            nombre: 'A',
            apellidoPaterno: 'B',
            apellidoMaterno: null,
            telefono: null,
            activo: true,
            roles: [],
            nombreCompleto: 'A B',
          },
        ],
        1,
      ]),
    };
    const service = new UsuariosService(
      stub<Repository<Usuario>>(usuarios),
      stub<Repository<Rol>>({}),
      stub<Repository<Alumno>>({}),
      stub<Repository<Docente>>({}),
      stub<Repository<UsuarioPlantel>>({}),
      stub<ScopeService>({}),
    );

    const respuesta = await service.listar(stub<PaginacionDto>({}));

    expect(JSON.stringify(respuesta)).not.toContain('hash-privado');
    expect(respuesta.datos[0]).not.toHaveProperty('passwordHash');
  });
});

describe('UsuariosService — restablecimiento de cuentas pendientes', () => {
  it('SUPERADMIN puede restablecer una cuenta pendiente y revoca el token de activación', async () => {
    const cuenta = {
      id: 17,
      activo: true,
      activacionPendiente: true,
      roles: [{ clave: 'ADMINISTRATIVO' }],
      sessionVersion: 0,
    };
    const usuarios = { findOne: jest.fn().mockResolvedValue(cuenta), save: jest.fn(async (v) => v) };
    const invalidaciones = { update: jest.fn().mockResolvedValue({ affected: 1 }) };
    const bitacora = { insert: jest.fn().mockResolvedValue({}) };
    const manager = {
      getRepository: jest.fn((entity: { name: string }) => {
        if (entity.name === 'Usuario') return usuarios;
        if (entity.name === 'BitacoraActividad') return bitacora;
        return invalidaciones;
      }),
    };
    const repo = {
      manager: { transaction: jest.fn(async (fn: (m: typeof manager) => Promise<unknown>) => fn(manager)) },
    };
    const service = new UsuariosService(
      stub<Repository<Usuario>>(repo),
      stub<Repository<Rol>>({}),
      stub<Repository<Alumno>>({}),
      stub<Repository<Docente>>({}),
      stub<Repository<UsuarioPlantel>>({}),
      stub<ScopeService>({}),
    );
    await service.restablecerPasswordAdministrativo(17, 'NuevaClave-Segura-2026!', {
      sub: 1,
      email: 'super@example.test',
      nombre: 'Super',
      roles: ['SUPERADMIN'],
    });
    expect(usuarios.save).toHaveBeenCalledWith(
      expect.objectContaining({
        activacionPendiente: false,
        passwordChangeRequired: true,
        sessionVersion: 1,
      }),
    );
    expect(invalidaciones.update).toHaveBeenCalledTimes(2);
  });

  it('ADMINISTRATIVO no puede saltar la activación pendiente', async () => {
    const usuarios = {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: 17, activo: true, activacionPendiente: true, roles: [{ clave: 'MAESTRO' }] }),
    };
    const manager = { getRepository: jest.fn(() => usuarios) };
    const repo = {
      manager: { transaction: jest.fn(async (fn: (m: typeof manager) => Promise<unknown>) => fn(manager)) },
    };
    const service = new UsuariosService(
      stub<Repository<Usuario>>(repo),
      stub<Repository<Rol>>({}),
      stub<Repository<Alumno>>({}),
      stub<Repository<Docente>>({}),
      stub<Repository<UsuarioPlantel>>({}),
      stub<ScopeService>({}),
    );
    await expect(
      service.restablecerPasswordAdministrativo(17, 'NuevaClave-Segura-2026!', {
        sub: 2,
        email: 'admin@example.test',
        nombre: 'Admin',
        roles: ['ADMINISTRATIVO'],
      }),
    ).rejects.toThrow('La cuenta requiere activación');
  });
});
