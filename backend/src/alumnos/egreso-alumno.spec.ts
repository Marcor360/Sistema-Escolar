import { ConflictException } from '@nestjs/common';
import { Inscripcion } from '../entities/inscripcion.entity';
import { cicloParaEgreso, fechaElegibleArchivo } from './egreso-alumno';

const inscripcion = (id: number, cicloId: number, fechaFin: string, estado: 'CERRADO' | 'ACTIVO') => ({
  id, grupo: { cicloId, ciclo: { id: cicloId, fechaFin, estado } },
}) as unknown as Pick<Inscripcion, 'id' | 'grupo'>;

describe('Egreso de alumnos', () => {
  it('identifica el último ciclo real cursado sin repetir al alumno en otro ciclo', () => {
    const ciclo = cicloParaEgreso([
      inscripcion(1, 4, '2024-07-30', 'CERRADO'),
      inscripcion(2, 5, '2025-07-30', 'CERRADO'),
    ]);
    expect(ciclo.id).toBe(5);
  });

  it('bloquea la ambigüedad de dos ciclos con la misma fecha final', () => {
    expect(() => cicloParaEgreso([
      inscripcion(1, 5, '2025-07-30', 'CERRADO'),
      inscripcion(2, 6, '2025-07-30', 'CERRADO'),
    ])).toThrow(ConflictException);
  });

  it('no permite declarar egreso sin cierre académico', () => {
    expect(() => cicloParaEgreso([inscripcion(1, 5, '2025-07-30', 'ACTIVO')])).toThrow(ConflictException);
    expect(() => cicloParaEgreso([])).toThrow(ConflictException);
  });

  it('calcula retención de cinco años calendario', () => {
    expect(fechaElegibleArchivo(new Date('2026-10-27T18:00:00Z')).toISOString())
      .toBe('2031-10-27T18:00:00.000Z');
  });
});
