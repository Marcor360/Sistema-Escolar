import { ForbiddenException } from '@nestjs/common';
import { ReportesService } from './reportes.service';
import { JwtUser } from '../common/current-user.decorator';

const alumnoUser: JwtUser = {
  sub: 50,
  email: 'alumno@escuela.mx',
  nombre: 'Alumno',
  roles: ['ALUMNO'],
};

const maestroUser: JwtUser = {
  sub: 60,
  email: 'maestro@escuela.mx',
  nombre: 'Maestro',
  roles: ['MAESTRO'],
};

describe('ReportesService.boletaPdf', () => {
  it('rechaza alumno pidiendo boleta ajena', async () => {
    const alumnosRepo = { findOne: jest.fn().mockResolvedValue({ id: 2, plantelId: 1, matricula: 'A2' }) };
    const alumnosService = { obtenerPorUsuario: jest.fn().mockResolvedValue({ id: 1, plantelId: 1 }) };
    const service = new ReportesService(
      alumnosRepo as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      alumnosService as any,
      {} as any,
      {} as any,
    );

    await expect(service.boletaPdf(2, alumnoUser, {} as any)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rechaza maestro pidiendo boleta de un alumno ajeno a sus grupos', async () => {
    const qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
    };
    const alumnosRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 2, plantelId: 1, matricula: 'A2' }),
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };
    const service = new ReportesService(
      alumnosRepo as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(service.boletaPdf(2, maestroUser, {} as any)).rejects.toThrow(
      'El alumno no pertenece a uno de tus grupos',
    );
    expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining('INNER JOIN grupos g'), {
      grupoActivo: true, inscripcionActiva: 'ACTIVA', actorId: maestroUser.sub,
    });
  });
});

describe('ReportesService.calificacionesExcel', () => {
  it('bloquea al MAESTRO en un grupo inactivo', async () => {
    const grupoMaterias = { findOne: jest.fn().mockResolvedValue({
      id: 9, docenteId: 4, grupo: { activo: false },
    }) };
    const docentes = { obtenerPorUsuario: jest.fn().mockResolvedValue({ id: 4 }) };
    const calificaciones = { find: jest.fn() };
    const service = new ReportesService(
      {} as any, {} as any, {} as any, grupoMaterias as any, calificaciones as any,
      {} as any, {} as any, docentes as any, {} as any, {} as any, {} as any,
    );

    await expect(service.calificacionesExcel(9, maestroUser, {} as any))
      .rejects.toThrow('El grupo no está activo');
    expect(calificaciones.find).not.toHaveBeenCalled();
  });
});
