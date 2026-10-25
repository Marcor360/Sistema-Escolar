import { ForbiddenException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Cargo } from '../entities/cargo.entity';
import { CuentaDeposito } from '../entities/cuenta-deposito.entity';
import { ScopeService } from '../planteles/scope.service';
import { ConfiguracionService } from '../configuracion/configuracion.service';
import { CargosService } from './cargos.service';
import { PagosService } from './pagos.service';
import { FichasService } from './fichas.service';

function contexto() {
  const cargo = { id: 1, alumnoId: 10, plantelId: 2, monto: 100, descuento: 0, recargo: 0,
    descripcion: 'Cargo sintético', estatus: 'PENDIENTE', plantel: { nombre: 'Plantel de origen' },
    alumno: { usuarioId: 5, matricula: 'QA', usuario: { nombreCompleto: 'Alumno QA' }, plantel: { nombre: 'Plantel tras traslado' } } };
  const scope = { validarGestion: jest.fn().mockResolvedValue(undefined) };
  const cargos = { saldoDeCargo: jest.fn().mockResolvedValue(100) };
  const marca = { obtener: jest.fn().mockResolvedValue({ nombreInstitucion: 'Institución sintética', nombreCorto: 'QA', logoUrl: null }) };
  const service = new FichasService(
    { findOne: jest.fn().mockResolvedValue(cargo) } as unknown as Repository<Cargo>,
    { findOneBy: jest.fn().mockResolvedValue({ titular: 'Prueba', numeroCuenta: '0000000000', clabe: null }) } as unknown as Repository<CuentaDeposito>,
    scope as unknown as ScopeService, cargos as unknown as CargosService,
    {} as PagosService, marca as unknown as ConfiguracionService,
  );
  return { service, scope };
}

describe('FichasService', () => {
  it('conserva el plantel del cargo tras trasladar al alumno', async () => {
    const { service, scope } = contexto();
    await expect(service.obtener(1, { sub: 7, email: 'qa@example.invalid', nombre: 'QA', roles: ['FINANZAS'] })).resolves.toMatchObject({ plantel: 'Plantel de origen' });
    expect(scope.validarGestion).toHaveBeenCalledWith({ sub: 7, email: 'qa@example.invalid', nombre: 'QA', roles: ['FINANZAS'] }, 2);
  });
  it('deniega fichas y PDFs de otro alumno', async () => {
    const { service } = contexto();
    await expect(service.obtener(1, { sub: 6, email: 'qa@example.invalid', nombre: 'QA', roles: ['ALUMNO'] })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.generarPdf(1, { sub: 6, email: 'qa@example.invalid', nombre: 'QA', roles: ['ALUMNO'] })).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('genera un PDF para el alumno dueño con cuenta sintética configurada', async () => {
    const { service } = contexto();
    const pdf = await service.generarPdf(1, { sub: 5, email: 'qa@example.invalid', nombre: 'QA', roles: ['ALUMNO'] });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(500);
  });
});
