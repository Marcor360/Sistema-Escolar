import type { Repository } from 'typeorm';
import type { EventoCalendario } from '../entities/evento-calendario.entity';
import type { Grupo } from '../entities/grupo.entity';
import type { GrupoMateria } from '../entities/grupo-materia.entity';
import type { Inscripcion } from '../entities/inscripcion.entity';
import type { Alumno } from '../entities/alumno.entity';
import type { Docente } from '../entities/docente.entity';
import type { ScopeService } from '../planteles/scope.service';
import { stub } from '../test-utils/stub';
import { CalendarioHistorial } from '../entities/calendario-historial.entity';
import { ForbiddenException } from '@nestjs/common';
import { CalendarioService } from './calendario.service';
import { JwtUser } from '../common/current-user.decorator';

const maestro: JwtUser = {
  sub: 20,
  email: 'maestro@escuela.mx',
  nombre: 'Maestro',
  roles: ['MAESTRO'],
};

describe('CalendarioService', () => {
  it('filtra los eventos de grupo al grupo-materia asignado al docente', async () => {
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    const eventos = { createQueryBuilder: jest.fn().mockReturnValue(qb) };
    const docentes = { findOne: jest.fn().mockResolvedValue({ id: 5 }) };
    const grupoMaterias = {
      find: jest
        .fn()
        .mockResolvedValue([
          { grupoId: 7, grupo: { activo: true, plantelId: 2, ciclo: { activo: true }, plantel: { activo: true } } },
        ]),
    };
    const scope = { resolverFiltro: jest.fn() };
    const service = new CalendarioService(
      stub<Repository<EventoCalendario>>(eventos),
      stub<Repository<Grupo>>({}),
      stub<Repository<GrupoMateria>>(grupoMaterias),
      stub<Repository<Inscripcion>>({}),
      stub<Repository<Alumno>>({}),
      stub<Repository<Docente>>(docentes),
      stub<ScopeService>(scope),
    );

    await service.listar(maestro);

    expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining('e.grupo_id IN (:...grupoIds)'), {
      planteles: [2],
      grupoIds: [7],
    });
    expect(scope.resolverFiltro).not.toHaveBeenCalled();
  });

  it('sin grupos activos, el maestro solo ve eventos globales', async () => {
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    const eventos = { createQueryBuilder: jest.fn().mockReturnValue(qb) };
    const docentes = { findOne: jest.fn().mockResolvedValue({ id: 5 }) };
    const grupoMaterias = {
      find: jest.fn().mockResolvedValue([{ grupoId: 7, grupo: { activo: false, plantelId: 2 } }]),
    };
    const service = new CalendarioService(
      stub<Repository<EventoCalendario>>(eventos),
      stub<Repository<Grupo>>({}),
      stub<Repository<GrupoMateria>>(grupoMaterias),
      stub<Repository<Inscripcion>>({}),
      stub<Repository<Alumno>>({}),
      stub<Repository<Docente>>(docentes),
      stub<ScopeService>({}),
    );

    await service.listar(maestro);

    expect(qb.andWhere).toHaveBeenCalledWith('(e.plantel_id IS NULL AND e.grupo_id IS NULL)');
  });

  it('maestro no puede crear evento global', async () => {
    const service = new CalendarioService(
      stub<Repository<EventoCalendario>>({}),
      stub<Repository<Grupo>>({}),
      stub<Repository<GrupoMateria>>({}),
      stub<Repository<Inscripcion>>({}),
      stub<Repository<Alumno>>({}),
      stub<Repository<Docente>>({}),
      stub<ScopeService>({}),
    );

    await expect(
      service.crear({ titulo: 'Global', fechaInicio: '2026-07-10T10:00:00.000Z' }, maestro),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('maestro no puede crear eventos para un grupo inactivo', async () => {
    const docentes = { findOne: jest.fn().mockResolvedValue({ id: 5 }) };
    const grupoMaterias = {
      findOne: jest.fn().mockResolvedValue({
        grupoId: 7,
        grupo: { activo: false, plantelId: 2 },
      }),
    };
    const service = new CalendarioService(
      stub<Repository<EventoCalendario>>({}),
      stub<Repository<Grupo>>({}),
      stub<Repository<GrupoMateria>>(grupoMaterias),
      stub<Repository<Inscripcion>>({}),
      stub<Repository<Alumno>>({}),
      stub<Repository<Docente>>(docentes),
      stub<ScopeService>({}),
    );

    await expect(
      service.crear(
        {
          titulo: 'Examen',
          grupoId: 7,
          fechaInicio: '2026-09-30T10:00:00.000Z',
        },
        maestro,
      ),
    ).rejects.toThrow('grupo inactivo');
  });
});

describe('Edición de calendario: regresiones de PR38', () => {
  function crear(override: Record<string, unknown> = {}) {
    const evento = {
      id: 17,
      creadoPorId: 20,
      plantelId: 2,
      grupoId: 7,
      fechaInicio: new Date('2026-11-01T10:00:00Z'),
      fechaFin: null,
      titulo: 'Examen',
      descripcion: null,
      tipo: 'EXAMEN',
      ...override,
    };
    const repo = { findOne: jest.fn().mockResolvedValue(evento), save: jest.fn(async (e: unknown) => e) };
    const manager = {
      getRepository: jest.fn((entidad: unknown) =>
        entidad === CalendarioHistorial ? { save: jest.fn().mockResolvedValue({}) } : repo,
      ),
    };
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([evento]),
    };
    const eventos = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
      manager: { transaction: jest.fn(async (fn: (m: typeof manager) => Promise<unknown>) => fn(manager)) },
    };
    const grupo = {
      id: 7,
      plantelId: 2,
      activo: true,
      ciclo: { activo: true, estado: 'ACTIVO' },
      plantel: { activo: true },
    };
    const service = new CalendarioService(
      eventos as never,
      { findOne: jest.fn().mockResolvedValue(grupo) } as never,
      { findOne: jest.fn().mockResolvedValue({ grupoId: 7, grupo }) } as never,
      {} as never,
      {} as never,
      { findOne: jest.fn().mockResolvedValue({ id: 5 }) } as never,
      {
        resolverFiltro: jest.fn().mockResolvedValue(null),
        validarGestion: jest.fn().mockResolvedValue(undefined),
      } as never,
    );
    const revision = async () => (await service.listar({ ...maestro, roles: ['SUPERADMIN'] }))[0].revision;
    return { service, repo, revision };
  }
  it('rechaza un evento ajeno antes de persistir', async () => {
    const { service, repo, revision } = crear({ creadoPorId: 99 });
    await expect(service.editar(17, { titulo: 'Cambio', revision: await revision() }, maestro)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(repo.save).not.toHaveBeenCalled();
  });
  it('detecta edición obsoleta incluso cuando no cambió la fecha inicial', async () => {
    const { service, repo, revision } = crear();
    const anterior = await revision();
    await service.editar(17, { titulo: 'Otro título', revision: anterior }, maestro);
    await expect(service.editar(17, { titulo: 'Sobrescritura', revision: anterior }, maestro)).rejects.toThrow(
      'El evento cambió',
    );
    expect(repo.save).toHaveBeenCalledTimes(1);
  });
  it('edita contenido propio sin cambiar grupo y normaliza el título', async () => {
    const { service, repo, revision } = crear();
    const actualizado = await service.editar(
      17,
      { titulo: '  Examen reprogramado ', revision: await revision() },
      maestro,
    );
    expect(actualizado.titulo).toBe('Examen reprogramado');
    expect(actualizado.grupoId).toBe(7);
    expect(repo.save).toHaveBeenCalledTimes(1);
  });
  it('no persiste una petición sin cambios', async () => {
    const { service, repo, revision } = crear();
    await expect(service.editar(17, { revision: await revision() }, maestro)).rejects.toThrow(
      'No se indicaron cambios',
    );
    expect(repo.save).not.toHaveBeenCalled();
  });
});

describe('Consulta de calendario por nivel', () => {
  it.each(['listar', 'consultar'] as const)('%s conserva avisos generales y el filtro de audiencia', async (metodo) => {
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    const service = new CalendarioService(
      { createQueryBuilder: () => qb } as never,
      {} as never,
      { find: jest.fn().mockResolvedValue([]) } as never,
      {} as never,
      {} as never,
      { findOne: jest.fn().mockResolvedValue({ id: 5 }) } as never,
      {} as never,
    );
    if (metodo === 'listar') await service.listar(maestro, undefined, undefined, undefined, 1, 2);
    else await service.consultar({ cicloId: 1, nivelId: 2, pagina: 1, porPagina: 10 }, maestro);
    expect(qb.andWhere).toHaveBeenCalledWith('(e.nivel_id = :nivelId OR e.nivel_id IS NULL)', { nivelId: 2 });
    expect(qb.andWhere).toHaveBeenCalledWith('e.audiencia = :audiencia', { audiencia: 'ACADEMICA' });
    expect(qb.andWhere).toHaveBeenCalledWith('e.nivel_id IS NULL', { niveles: [] });
  });
});
