import { BadRequestException, ConflictException } from '@nestjs/common';
import { ConceptoPago } from '../entities';
import { cotizarCuotasReinscripcion } from './cuotas-reinscripcion';
import { ReinscripcionPeriodoDto } from './reinscripcion-periodo.dto';
const conceptos = [{ id: 1, nombre: 'Colegiatura', tipo: 'COLEGIATURA', montoBase: 100.01 }] as ConceptoPago[];
const d = { conceptoIds: [1], periodo: '2057-02', fechaVencimiento: '2057-02-05' } as ReinscripcionPeriodoDto;
const cuota = (periodo: string, monto: number, descuento = 0) => ({
  conceptoId: 1,
  periodo,
  monto,
  descuento,
  fechaVencimiento: periodo + '-05',
});
const cotizar = (cambio: Partial<ReinscripcionPeriodoDto>) =>
  cotizarCuotasReinscripcion({ ...d, ...cambio }, conceptos, '2057-01-01', '2057-12-31');
it('divide el total en centavos sin agregar otra mensualidad ni aplicar el descuento dos veces', () => {
  const { cuotas } = cotizar({
    motivo: 'Beca aprobada para el periodo',
    parcialidades: [cuota('2057-03', 50.01, 10), cuota('2057-02', 50)],
  });
  expect(cuotas).toHaveLength(2);
  expect(cuotas.map((q) => q.periodo)).toEqual(['2057-02', '2057-03']);
  expect(cuotas.reduce((sum, q) => sum + Math.round(q.monto * 100) - Math.round(q.descuento * 100), 0)).toBe(9001);
});
it.each([
  [cuota('2057-02', 50), cuota('2057-03', 50)],
  [cuota('2057-02', 50), cuota('2057-02', 50.01)],
  [cuota('2058-02', 100.01)],
  [cuota('2057-02', 100.01, 100.02)],
])('rechaza sumas incompatibles, duplicados, fechas externas y descuentos excesivos: %j', (...parcialidades) => {
  expect(() => cotizar({ parcialidades })).toThrow(BadRequestException);
});
it('exige motivo documentado para una tarifa personalizada o descuento', () => {
  expect(() => cotizar({ parcialidades: [cuota('2057-02', 100.01, 1)] })).toThrow(/motivo documentado/);
  expect(() =>
    cotizar({
      ajustes: [{ conceptoId: 1, monto: 80, motivo: 'Beca autorizada para el periodo' }],
      parcialidades: [cuota('2057-02', 80)],
    }),
  ).not.toThrow();
});
it('no permite usar dos tarifas de colegiatura o conceptos fuera del flujo', () => {
  expect(() =>
    cotizarCuotasReinscripcion(
      { ...d, conceptoIds: [1, 2] },
      [...conceptos, { ...conceptos[0], id: 2 }],
      '2057-01-01',
      '2057-12-31',
    ),
  ).toThrow(ConflictException);
});
