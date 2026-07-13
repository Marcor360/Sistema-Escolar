import { ConflictException, ForbiddenException } from '@nestjs/common';
import { AcademicoService } from './academico.service';

function crearServicio(overrides: {
  grupos?: any;
  grupoMaterias?: any;
  inscripciones?: any;
  calificaciones?: any;
  actividades?: any;
  materiales?: any;
  scope?: any;
}) {
  return new AcademicoService(
    {} as any,
    {} as any,
    overrides.grupos ?? ({} as any),
    overrides.grupoMaterias ?? ({} as any),
    overrides.inscripciones ?? ({} as any),
    {} as any,
    overrides.calificaciones ?? ({} as any),
    overrides.actividades ?? ({} as any),
    overrides.materiales ?? ({} as any),
    {} as any,
    overrides.scope ?? ({ validarGestion: jest.fn().mockResolvedValue(undefined) } as any),
  );
}

describe('AcademicoService.eliminarGrupo', () => {
  it('rechaza la baja si el grupo tiene inscripciones activas', async () => {
    const grupos = {
      findOne: jest.fn().mockResolvedValue({ id: 1, plantelId: 5, activo: true }),
      update: jest.fn(),
    };
    const inscripciones = { count: jest.fn().mockResolvedValue(3) };
    const scope = { validarGestion: jest.fn().mockResolvedValue(undefined) };
    const service = crearServicio({ grupos, inscripciones, scope });

    await expect(service.eliminarGrupo(1, { sub: 1, roles: ['ADMINISTRATIVO'] } as any))
      .rejects.toThrow(ConflictException);
    expect(grupos.update).not.toHaveBeenCalled();
  });

  it('da de baja el grupo cuando no hay inscripciones activas', async () => {
    const grupos = {
      findOne: jest.fn().mockResolvedValue({ id: 1, plantelId: 5, activo: true }),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const inscripciones = { count: jest.fn().mockResolvedValue(0) };
    const scope = { validarGestion: jest.fn().mockResolvedValue(undefined) };
    const service = crearServicio({ grupos, inscripciones, scope });

    const resultado = await service.eliminarGrupo(1, { sub: 1, roles: ['ADMINISTRATIVO'] } as any);

    expect(grupos.update).toHaveBeenCalledWith(1, { activo: false });
    expect(resultado).toEqual({ ok: true });
  });
});

describe('AcademicoService.eliminarGrupoMateria', () => {
  it('rechaza la baja si existen calificaciones ligadas', async () => {
    const grupoMaterias = {
      findOne: jest.fn().mockResolvedValue({ id: 10, grupo: { plantelId: 5 } }),
      delete: jest.fn(),
    };
    const calificaciones = { count: jest.fn().mockResolvedValue(2) };
    const actividades = { count: jest.fn().mockResolvedValue(0) };
    const materiales = { count: jest.fn().mockResolvedValue(0) };
    const scope = { validarGestion: jest.fn().mockResolvedValue(undefined) };
    const service = crearServicio({ grupoMaterias, calificaciones, actividades, materiales, scope });

    await expect(service.eliminarGrupoMateria(10, { sub: 1, roles: ['ADMINISTRATIVO'] } as any))
      .rejects.toThrow(ConflictException);
    expect(grupoMaterias.delete).not.toHaveBeenCalled();
  });
});

describe('AcademicoService.actualizarGrupo', () => {
  it('lanza ForbiddenException cuando el grupo está fuera del alcance del usuario', async () => {
    const grupos = { findOne: jest.fn().mockResolvedValue({ id: 1, plantelId: 5, activo: true }) };
    const scope = { validarGestion: jest.fn().mockRejectedValue(new ForbiddenException()) };
    const service = crearServicio({ grupos, scope });

    await expect(service.actualizarGrupo(1, { nombre: 'A' } as any, { sub: 1, roles: ['ADMINISTRATIVO'] } as any))
      .rejects.toThrow(ForbiddenException);
  });
});

describe('AcademicoService.listarGrupos', () => {
  it('excluye grupos inactivos por defecto', async () => {
    const grupos = { findAndCount: jest.fn().mockResolvedValue([[], 0]) };
    const scope = { resolverFiltro: jest.fn().mockResolvedValue(null) };
    const service = crearServicio({ grupos, scope });

    await service.listarGrupos({ sub: 1, roles: ['ADMINISTRATIVO'] } as any, { pagina: 1, porPagina: 20 } as any);

    expect(grupos.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ activo: true }) }),
    );
  });
});
