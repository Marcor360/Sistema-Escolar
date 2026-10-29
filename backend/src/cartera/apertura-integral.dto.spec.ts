import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AperturaIntegralDto } from './apertura-integral.dto';

const valido = {
  nuevoAlumno: { nombre: 'Ana', apellidoPaterno: 'Prueba', matricula: 'QA01', curp: 'AAAA010101HDFLRN09' },
  plantelId: 1,
  cicloId: 1,
  nivelId: 1,
  carreraId: 1,
  periodoAcademicoId: 1,
  turno: 'MATUTINO',
  asignacion: 'PAUSA',
  total: 200,
  cuotas: [
    { conceptoId: 1, periodo: '2027-01', fechaVencimiento: '2027-01-05', monto: 100 },
    { conceptoId: 1, periodo: '2027-02', fechaVencimiento: '2027-02-05', monto: 100 },
  ],
};
describe('Contrato de apertura integral', () => {
  it('acepta identidad sin correo ni credenciales y valida cada cuota', () => {
    expect(validateSync(plainToInstance(AperturaIntegralDto, valido))).toHaveLength(0);
    for (const cambio of [{ monto: -1 }, { monto: 1.123 }, { periodo: '2027-13' }, { fechaVencimiento: 'no-fecha' }]) {
      const dto = plainToInstance(AperturaIntegralDto, { ...valido, cuotas: [{ ...valido.cuotas[0], ...cambio }] });
      expect(validateSync(dto).map((e) => e.property)).toContain('cuotas');
    }
  });
  it('no admite asignar correo o contraseña dentro del alta anidada', () => {
    const dto = plainToInstance(AperturaIntegralDto, {
      ...valido,
      nuevoAlumno: { ...valido.nuevoAlumno, email: 'no@example.invalid', password: 'no-admitida' },
    });
    const errors = validateSync(dto, { whitelist: true, forbidNonWhitelisted: true });
    expect(errors[0].property).toBe('nuevoAlumno');
    expect(errors[0].children?.map((e) => e.property)).toEqual(expect.arrayContaining(['email', 'password']));
  });
});
