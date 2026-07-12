import { BadRequestException } from '@nestjs/common';
import { OrdenesService } from './ordenes.service';

const alumnoUser = { sub: 5, email: 'alumno@escuela.mx', nombre: 'Alumno', roles: ['ALUMNO'] } as any;
const finanzasUser = { sub: 77, email: 'finanzas@escuela.mx', nombre: 'Finanzas', roles: ['FINANZAS'] } as any;

describe('OrdenesService.crear', () => {
  it('rechaza a un alumno creando una orden de un cargo ajeno', async () => {
    const cargos = { obtener: jest.fn().mockResolvedValue({ id: 1, alumnoId: 999 }), saldoDeCargo: jest.fn() };
    const alumnos = { obtenerPorUsuario: jest.fn().mockResolvedValue({ id: 5 }), obtener: jest.fn() };
    const service = new OrdenesService({} as any, alumnos as any, cargos as any, {} as any, {} as any, {} as any, {} as any);

    await expect(service.crear(1, alumnoUser)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza crear una orden si el cargo ya no tiene saldo pendiente', async () => {
    const cargos = { obtener: jest.fn().mockResolvedValue({ id: 1, alumnoId: 5 }), saldoDeCargo: jest.fn().mockResolvedValue(0) };
    const alumnos = { obtenerPorUsuario: jest.fn().mockResolvedValue({ id: 5 }), obtener: jest.fn() };
    const service = new OrdenesService({} as any, alumnos as any, cargos as any, {} as any, {} as any, {} as any, {} as any);

    await expect(service.crear(1, alumnoUser)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('para personal (FINANZAS), valida el alumno del cargo vía alumnos.obtener (alcance de plantel)', async () => {
    const cargo = { id: 1, alumnoId: 10, descripcion: 'Colegiatura', alumno: { usuario: { nombreCompleto: 'X Y', email: 'x@escuela.mx' } } };
    const cargos = { obtener: jest.fn().mockResolvedValue(cargo), saldoDeCargo: jest.fn().mockResolvedValue(500) };
    const alumnos = {
      obtenerPorUsuario: jest.fn().mockRejectedValue(new Error('el usuario no tiene expediente de alumno')),
      obtener: jest.fn().mockResolvedValue({ id: 10 }),
    };
    const ordenesRepo = { create: jest.fn((d) => d), save: jest.fn((d) => Promise.resolve({ id: 1, ...d })) };
    const openpay = { crearCargoRedirect: jest.fn().mockResolvedValue({ id: 'ch_1', payment_method: { url: 'http://pago' }, due_date: null }) };
    const bitacora = { registrar: jest.fn().mockResolvedValue(undefined) };
    const service = new OrdenesService(ordenesRepo as any, alumnos as any, cargos as any, {} as any, openpay as any, {} as any, bitacora as any);

    await service.crear(1, finanzasUser);

    expect(alumnos.obtener).toHaveBeenCalledWith(10, finanzasUser);
  });
});
