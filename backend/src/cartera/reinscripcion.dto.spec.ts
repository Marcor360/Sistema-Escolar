import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PrevisualizarReinscripcionDto, ConfirmarReinscripcionDto } from './cartera.dto';

const datos = {
  alumnoId: 1, plantelId: 2, cicloId: 3, nivelId: 4, carreraId: 5,
  periodoAcademicoId: 6, turno: 'MATUTINO', conceptoIds: [10],
  periodo: '2026-11', fechaVencimiento: '2026-11-10', origenInscripcionId: 9,
};

describe('DTO de reinscripción', () => {
  it('acepta avance sin motivo, con matrícula resuelta previamente por ID', async () => {
    expect(await validate(plainToInstance(PrevisualizarReinscripcionDto, datos))).toHaveLength(0);
  });
  it('rechaza motivo insuficiente, ajuste sin detalle y monto negativo', async () => {
    const dto = plainToInstance(PrevisualizarReinscripcionDto, {
      ...datos, motivo: 'reprobo', ajustes: [{ conceptoId: 10, monto: -1, motivo: 'sin razón' }],
    });
    const errores = await validate(dto);
    expect(errores.map(e => e.property)).toEqual(expect.arrayContaining(['motivo','ajustes']));
  });
  it('exige cotización, confirmación y UUID', async () => {
    const dto = plainToInstance(ConfirmarReinscripcionDto, { ...datos, confirmado: false, idempotencia: 'otra', cotizacion: 'sin-firma' });
    const errores = await validate(dto);
    expect(errores.map(e => e.property)).toEqual(expect.arrayContaining(['confirmado','idempotencia','cotizacion']));
  });
});
