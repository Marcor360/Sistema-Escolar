import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ConfirmarProgramacionDto, EmitirCuotaDto } from './programaciones-persistidas.dto';

describe('contrato de programación persistida', () => {
  const base = {
    modalidad: 'SUPERIOR',
    total: 1000.01,
    mesInicio: '2027-01',
    diaVencimiento: 5,
    alumnoId: 1,
    plantelId: 1,
    cicloId: 1,
    periodoAcademicoId: 1,
    conceptoId: 1,
    idempotencia: '12aebb82-a620-4d4d-bb4f-336c66da9178',
    confirmado: true,
  };
  it('valida total, fechas, alumno, periodo, concepto e idempotencia antes de guardar', async () => {
    expect(await validate(plainToInstance(ConfirmarProgramacionDto, base))).toHaveLength(0);
    const mal = { ...base, alumnoId: 0, idempotencia: 'no-es-uuid', mesInicio: '2027-99', total: -1 };
    expect((await validate(plainToInstance(ConfirmarProgramacionDto, mal))).map((e) => e.property)).toEqual(
      expect.arrayContaining(['alumnoId', 'idempotencia', 'mesInicio', 'total']),
    );
  });
  it('no emite cargos sin confirmación explícita', async () => {
    expect(await validate(plainToInstance(EmitirCuotaDto, { confirmado: true }))).toHaveLength(0);
    expect((await validate(plainToInstance(EmitirCuotaDto, { confirmado: false }))).map((e) => e.property)).toContain(
      'confirmado',
    );
  });
});
