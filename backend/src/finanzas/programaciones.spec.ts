import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { BadRequestException } from '@nestjs/common';
import { PrevisualizarProgramacionDto } from './programaciones.dto';
import { previsualizarProgramacion } from './programaciones';

const base = { total: 1000.01, mesInicio: '2027-01', diaVencimiento: 4 };

describe('previsualizarProgramacion', () => {
  it('secundaria: registra un total de anualidad, sin distribuir automáticamente meses', () => {
    const res = previsualizarProgramacion({ ...base, modalidad: 'SECUNDARIA' });
    expect(res.cuotas).toEqual([{ numero: 1, periodo: '2027-01', fechaVencimiento: '2027-01-04', monto: 1000.01, etiqueta: 'Anualidad escolar 1 de 1' }]);
  });

  it('bachillerato: dos semestres; se pueden ajustar individualmente sin cambiar total anual', () => {
    const res = previsualizarProgramacion({ ...base, modalidad: 'BACHILLERATO', importes: [600, 400.01] });
    expect(res.cuotas.map(c => c.periodo)).toEqual(['2027-01', '2027-07']);
    expect(res.cuotas.map(c => c.monto)).toEqual([600, 400.01]);
    expect(() => previsualizarProgramacion({ ...base, modalidad: 'BACHILLERATO', importes: [700, 400] })).toThrow(BadRequestException);
  });

  it('cuatrimestre: cuatro mensualidades con redondeo estable a centavos', () => {
    const res = previsualizarProgramacion({ ...base, modalidad: 'SUPERIOR' });
    expect(res.cuotas.map(c => c.periodo)).toEqual(['2027-01', '2027-02', '2027-03', '2027-04']);
    expect(res.cuotas.map(c => c.monto)).toEqual([250.01, 250, 250, 250]);
  });

  it('concepto adicional: una exhibición o 3 parcialidades con total exacto', () => {
    const r1 = previsualizarProgramacion({ ...base, modalidad: 'ADICIONAL', numeroCuotas: 1 });
    const r3 = previsualizarProgramacion({ ...base, modalidad: 'ADICIONAL', numeroCuotas: 3 });
    expect(r1.cuotas).toHaveLength(1);
    expect(r3.cuotas.map(x=>x.monto)).toEqual([333.34,333.34,333.33]);
    expect(r3.cuotas.reduce((a,b)=>a+Math.round(b.monto*100),0)).toBe(100001);
  });

  it('bloquea cuota 0, montos negativos, meses irreales y modalidades con cuotas no autorizadas', async () => {
    const errores = await validate(plainToInstance(PrevisualizarProgramacionDto, { ...base, modalidad: 'SUPERIOR', mesInicio: '2027-13' }));
    expect(errores.map(x=>x.property)).toContain('mesInicio');
    expect(()=>previsualizarProgramacion({ ...base, modalidad: 'SUPERIOR', numeroCuotas: 3 })).toThrow(BadRequestException);
    expect(()=>previsualizarProgramacion({ ...base, modalidad: 'ADICIONAL', numeroCuotas: 0 })).toThrow(BadRequestException);
    expect(()=>previsualizarProgramacion({ ...base, modalidad: 'BACHILLERATO', importes: [1000.01, 0] })).toThrow(BadRequestException);
  });
});
