import { ForbiddenException } from '@nestjs/common';
import { AlumnosService } from './alumnos.service';

describe('AlumnosService.listar', () => {
  it('pagina=2, porPagina=20 aplica skip(20).take(20) y devuelve el total', async () => {
    const qb: any = {};
    ['leftJoinAndSelect', 'andWhere', 'orderBy', 'skip', 'take'].forEach((metodo) => {
      qb[metodo] = jest.fn().mockReturnValue(qb);
    });
    qb.getManyAndCount = jest.fn().mockResolvedValue([[
      { id: 1, matricula: 'A1', estatus: 'ACTIVO', usuario: {
        nombre: 'Ana', apellidoPaterno: 'López', apellidoMaterno: null,
      }, plantel: null },
    ], 45]);
    const alumnosRepo = { createQueryBuilder: jest.fn().mockReturnValue(qb) };
    const service = new AlumnosService(alumnosRepo as any, {} as any, {} as any, {} as any, {} as any, {} as any);

    const resultado = await service.listar({ pagina: 2, porPagina: 20 } as any);

    expect(qb.skip).toHaveBeenCalledWith(20);
    expect(qb.take).toHaveBeenCalledWith(20);
    expect(resultado).toEqual({ datos: [{
      id: 1, matricula: 'A1', estatus: 'ACTIVO',
      usuario: { nombre: 'Ana', apellidoPaterno: 'López', apellidoMaterno: null }, plantel: null,
    }], total: 45, pagina: 2, porPagina: 20 });
  });

  it('limita la lista de MAESTRO a alumnos inscritos en sus grupos activos sin exigir plantel', async () => {
    const qb: any = {};
    ['leftJoinAndSelect', 'andWhere', 'orderBy', 'skip', 'take'].forEach((metodo) => {
      qb[metodo] = jest.fn().mockReturnValue(qb);
    });
    qb.getManyAndCount = jest.fn().mockResolvedValue([[], 0]);
    const scope = { resolverFiltro: jest.fn() };
    const service = new AlumnosService(
      { createQueryBuilder: jest.fn().mockReturnValue(qb) } as any,
      {} as any, {} as any, {} as any, scope as any, {} as any,
    );

    await service.listar({ pagina: 1, porPagina: 20 } as any, {
      sub: 17, email: 'maestro@example.invalid', nombre: 'Maestro', roles: ['MAESTRO'],
    });

    expect(qb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('INNER JOIN grupos g'),
      expect.objectContaining({ docenteUsuarioId: 17, estatusInscripcion: 'ACTIVA', grupoActivo: true }),
    );
    expect(qb.andWhere).not.toHaveBeenCalledWith('a.plantel_id IN (:...planteles)', expect.anything());
    expect(scope.resolverFiltro).not.toHaveBeenCalled();
  });
});

describe('AlumnosService.obtener alcance docente', () => {
  it('rechaza el perfil de un alumno que no pertenece a grupos del docente', async () => {
    const qb = {
      where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
    };
    const inscripciones = { createQueryBuilder: jest.fn().mockReturnValue(qb) };
    const scope = { validarGestion: jest.fn() };
    const service = new AlumnosService(
      { findOne: jest.fn().mockResolvedValue({ id: 8, plantelId: 1 }) } as any,
      inscripciones as any, {} as any, {} as any, scope as any, {} as any,
    );

    await expect(service.obtener(8, {
      sub: 7, email: 'maestro@example.invalid', nombre: 'Maestro', roles: ['MAESTRO'],
    })).rejects.toBeInstanceOf(ForbiddenException);
    expect(scope.validarGestion).not.toHaveBeenCalled();
  });

  it('permite al MAESTRO su alumno relacionado por grupo activo aunque no tenga asignación de plantel', async () => {
    const qb = {
      where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(1),
    };
    const alumno = { id: 8, plantelId: 1 };
    const inscripciones = { createQueryBuilder: jest.fn().mockReturnValue(qb) };
    const scope = { validarGestion: jest.fn() };
    const service = new AlumnosService(
      { findOne: jest.fn().mockResolvedValue(alumno) } as any,
      inscripciones as any, {} as any, {} as any, scope as any, {} as any,
    );

    await expect(service.obtener(8, {
      sub: 7, email: 'maestro@example.invalid', nombre: 'Maestro', roles: ['MAESTRO'],
    })).resolves.toBe(alumno);
    expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining('g.activo = :grupoActivo'), {
      grupoActivo: true, usuarioId: 7,
    });
    expect(scope.validarGestion).not.toHaveBeenCalled();
  });
});

describe('AlumnosService.obtenerParaApi', () => {
  it('FINANZAS recibe el resumen operativo sin datos personales del expediente', async () => {
    const alumno = {
      id: 8, matricula: 'A008', estatus: 'ACTIVO', plantelId: 1,
      curp: 'CURP-PRIVADA', fechaNacimiento: '2012-01-01', tutorNombre: 'Tutor',
      tutorTelefono: '5550000000', direccion: 'Dirección privada',
      plantel: { id: 1, nombre: 'Plantel A' },
      usuario: {
        id: 80, nombre: 'Ana', apellidoPaterno: 'López', apellidoMaterno: null,
        email: 'ana@example.invalid', telefono: '5551111111',
      },
    };
    const service = new AlumnosService(
      { findOne: jest.fn().mockResolvedValue(alumno) } as any, {} as any, {} as any, {} as any,
      { validarGestion: jest.fn().mockResolvedValue(undefined) } as any, {} as any,
    );

    const respuesta = await service.obtenerParaApi(8, {
      sub: 2, email: 'finanzas@example.invalid', nombre: 'Finanzas', roles: ['FINANZAS'],
    });

    expect(respuesta).toMatchObject({ id: 8, matricula: 'A008', plantelId: 1 });
    expect(JSON.stringify(respuesta)).not.toContain('CURP-PRIVADA');
    expect(JSON.stringify(respuesta)).not.toContain('5550000000');
    expect(JSON.stringify(respuesta)).not.toContain('Dirección privada');
    expect(JSON.stringify(respuesta)).not.toContain('ana@example.invalid');
  });
});
