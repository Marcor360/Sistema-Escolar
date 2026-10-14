import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as ExcelJS from 'exceljs';
import { ImportacionCalificacionesService } from './importacion-calificaciones.service';
import { GrupoMateria } from '../entities';
const user = { sub: 20, nombre: 'Maestro', email: 'docente@example.invalid', roles: ['MAESTRO'] };
function crear(filas: unknown[] = []) {
  const notas = { estadoPeriodo: jest.fn().mockResolvedValue({ estatus: 'ABIERTO' }) };
  const gm = {
    findOneByOrFail: jest
      .fn()
      .mockResolvedValue({
        id: 7,
        grupoId: 8,
        grupo: { grado: '1', nombre: '1-A', plantel: { nombre: 'Centro' }, ciclo: { clave: '2026' } },
        materia: { clave: 'MAT' },
      }),
  };
  const inscripciones = { find: jest.fn().mockResolvedValue(filas) };
  const ds = { getRepository: jest.fn((entity) => (entity === GrupoMateria ? gm : inscripciones)) };
  return {
    service: new ImportacionCalificacionesService(
      ds as never,
      notas as never,
      new ConfigService({ JWT_SECRET: 'solo-prueba' }),
    ),
    notas,
    ds,
  };
}
it('rechaza parcial inválido antes de consultar expedientes', async () => {
  const { service, ds, notas } = crear();
  await expect(service.plantilla({ grupoMateriaId: 7, parcial: 4 }, user)).rejects.toBeInstanceOf(BadRequestException);
  expect(ds.getRepository).not.toHaveBeenCalled();
  expect(notas.estadoPeriodo).not.toHaveBeenCalled();
});
it('un docente sin acceso a la clase no obtiene su roster', async () => {
  const { service, ds, notas } = crear();
  notas.estadoPeriodo.mockRejectedValue(new ForbiddenException('Clase ajena'));
  await expect(service.plantilla({ grupoMateriaId: 7, parcial: 1 }, user)).rejects.toBeInstanceOf(ForbiddenException);
  expect(ds.getRepository).not.toHaveBeenCalled();
});
it('rechaza plantillas de más de 500 alumnos', async () => {
  const { service } = crear(Array.from({ length: 501 }, () => ({})));
  await expect(service.plantilla({ grupoMateriaId: 7, parcial: 1 }, user)).rejects.toThrow('500 inscritos');
});
it('genera identificadores, nombre y validación Excel sin rellenar pendientes con cero', async () => {
  const { service } = crear([{ alumnoId: 3, alumno: { matricula: 'AL3', usuario: { nombreCompleto: 'Ana Prueba' } } }]);
  const buffer = await service.plantilla({ grupoMateriaId: 7, parcial: 0 }, user);
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(buffer as never);
  const hoja = libro.worksheets[0];
  expect(hoja.getCell('A2').value).toBe(7);
  expect(hoja.getCell('B2').value).toBe(0);
  expect(hoja.getCell('C2').value).toBe(3);
  expect(hoja.getCell('D2').value).toBe('AL3');
  expect(hoja.getCell('H2').value).toBe('Ana Prueba');
  expect([null, '']).toContain(hoja.getCell('F2').value);
  expect(hoja.getCell('F2').dataValidation).toMatchObject({ type: 'decimal', operator: 'between', formulae: [0, 100] });
  expect(libro.getWorksheet('Instrucciones')).toBeDefined();
  expect(hoja.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
  expect(hoja.autoFilter).toBeTruthy();
  expect(hoja.getColumn(4).numFmt).toBe('@');
  expect(hoja.getCell('F2').fill).toMatchObject({
    type: 'pattern',
    fgColor: { argb: 'FFFFF2CB' },
  });
  expect(String(libro.getWorksheet('Instrucciones')?.getCell('A2').value)).toContain('columna F');
});
