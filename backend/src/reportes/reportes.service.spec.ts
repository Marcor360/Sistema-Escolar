import { PassThrough } from 'stream';
import * as ExcelJS from 'exceljs';
import type { Response } from 'express';
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

describe('Reportes financieros descargables', () => {
  it('resuelve el alumno exclusivamente desde la sesión para su PDF', async () => {
    const alumnos = { obtenerPorUsuario: jest.fn().mockResolvedValue({ id: 17 }) };
    const service = new ReportesService(
      {} as any, {} as any, {} as any, {} as any, {} as any, {} as any,
      {} as any, {} as any, alumnos as any, {} as any, {} as any,
    );
    const exportar = jest.spyOn(service, 'estadoCuentaPdf').mockResolvedValue();
    const res = {} as any;
    await service.miEstadoCuentaPdf(alumnoUser, res);
    expect(alumnos.obtenerPorUsuario).toHaveBeenCalledWith(alumnoUser.sub);
    expect(exportar).toHaveBeenCalledWith(17, undefined, res);
  });

  it('rechaza PDF fuera de alcance antes de iniciar la descarga', async () => {
    const cargos = { estadoDeCuenta: jest.fn().mockRejectedValue(new ForbiddenException()) };
    const service = new ReportesService(
      {} as any, {} as any, {} as any, {} as any, {} as any, {} as any,
      cargos as any, {} as any, {} as any, {} as any, {} as any,
    );
    const res = { setHeader: jest.fn() } as any;
    await expect(service.estadoCuentaPdf(9, alumnoUser, res)).rejects.toBeInstanceOf(ForbiddenException);
    expect(res.setHeader).not.toHaveBeenCalled();
  });
});

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
      'La boleta completa es exclusiva',
    );
    expect(qb.andWhere).not.toHaveBeenCalled();
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


describe('Fecha institucional en XLSX de bajas', () => {
  it('conserva el día mexicano durante el cambio de fecha UTC y de año', async () => {
    const instantes = ['2026-10-23T02:30:00Z', '2027-01-01T05:59:59Z', '2027-01-01T06:00:00Z'];
    const qb = {
      innerJoinAndSelect: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(), orderBy: jest.fn().mockReturnThis(), take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(instantes.map((fecha, id) => ({
        matricula: `A${id}`, usuario: { nombreCompleto: 'Alumno' }, plantel: { nombre: 'Plantel' },
        estatus: 'BAJA', updatedAt: new Date(fecha),
      }))),
    };
    const service = new ReportesService(
      { createQueryBuilder: () => qb } as any, {} as any, {} as any, {} as any, {} as any,
      {} as any, {} as any, {} as any, {} as any,
      { resolverFiltro: jest.fn().mockResolvedValue([3]) } as any, {} as any,
    );
    const res = Object.assign(new PassThrough(), { setHeader: jest.fn() });
    const chunks: Buffer[] = [];
    res.on('data', (chunk: Buffer) => chunks.push(chunk));
    const terminado = new Promise<void>((resolve, reject) => { res.on('end', resolve); res.on('error', reject); });
    await service.bajasExcel(alumnoUser, res as unknown as Response, 3);
    await terminado;
    const libro = new ExcelJS.Workbook();
    const entrada = new PassThrough();
    entrada.end(Buffer.concat(chunks));
    await libro.xlsx.read(entrada);
    const hoja = libro.getWorksheet('Bajas actuales')!;
    expect([2, 3, 4].map((fila) => hoja.getCell(fila, 5).value))
      .toEqual(['2026-10-22', '2026-12-31', '2027-01-01']);
  });
});

describe('Serie mensual de cobranza', () => {
  afterEach(() => jest.useRealTimers());
  it('usa el mes de México al cambiar de año y filtra pagos confirmados por plantel de origen', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2027-01-01T02:00:00Z'));
    const qb = {
      select: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(), getRawOne: jest.fn().mockResolvedValue({ total: '125.50' }),
    };
    const scope = { resolverFiltro: jest.fn().mockResolvedValue([3]) };
    const service = new ReportesService(
      {} as any, {} as any, {} as any, {} as any, {} as any,
      { createQueryBuilder: () => qb } as any, {} as any, {} as any, {} as any, scope as any, {} as any,
    );
    const serie = await service.serieCobranza(alumnoUser, 3);
    expect(serie.datos.map((p) => p.periodo)).toEqual(['2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12']);
    expect(serie.datos.every((p) => p.cobrado === 125.5)).toBe(true);
    expect(qb.where).toHaveBeenCalledWith('p.estatus = :estatus', { estatus: 'CONFIRMADO' });
    expect(qb.andWhere).toHaveBeenCalledWith('p.plantel_id IN (:...planteles)', { planteles: [3] });
    expect(qb.andWhere).toHaveBeenCalledWith('p.fecha_pago >= :inicio AND p.fecha_pago < :fin', { inicio: '2026-12-01', fin: '2027-01-01' });
  });
  it('no consulta pagos cuando el plantel no está autorizado', async () => {
    const pagos = { createQueryBuilder: jest.fn() };
    const service = new ReportesService(
      {} as any, {} as any, {} as any, {} as any, {} as any, pagos as any,
      {} as any, {} as any, {} as any,
      { resolverFiltro: jest.fn().mockRejectedValue(new ForbiddenException()) } as any, {} as any,
    );
    await expect(service.serieCobranza(alumnoUser, 9)).rejects.toBeInstanceOf(ForbiddenException);
    expect(pagos.createQueryBuilder).not.toHaveBeenCalled();
  });
});
