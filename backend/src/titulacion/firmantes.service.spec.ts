import type { Repository } from 'typeorm';
import type { TitulacionFirmante } from '../entities/titulacion-firmante.entity';
import type { ScopeService } from '../planteles/scope.service';
import { stub } from '../test-utils/stub';
import { FirmantesService } from './firmantes.service';

const actor = { sub: 2, nombre: 'Rector', email: 'rector@example.test', roles: ['DIRECTOR'], portal: 'WEB' as const };
const dto = {
  plantelId: 3, nombre: 'Rector de prueba', cargo: 'Rector', curp: 'AAAA000101HDFBBB00',
  vigenteDesde: '2026-01-01',
};
function crear() {
  const repositorio = {
    create: jest.fn((data: unknown) => data),
    save: jest.fn(async (data: Record<string, unknown>) => ({ id: 5, ...data })),
    findOne: jest.fn().mockResolvedValue({
      id: 5, plantelId: 3, nombre: dto.nombre, cargo: dto.cargo,
      estado: 'PENDIENTE_VALIDACION',
      vigenteDesde: '2026-01-01', vigenteHasta: null, certificadoSha256: null,
    }),
  };
  const scope = { validarGestion: jest.fn().mockResolvedValue(undefined) };
  const servicio = new FirmantesService(
    stub<Repository<TitulacionFirmante>>(repositorio),
    stub<ScopeService>(scope),
  );
  return { servicio, repositorio, scope };
}

describe('firmantes de titulación', () => {
  it('rechaza operaciones sin DIRECTOR', async () => {
    const { servicio } = crear();
    await expect(servicio.registrar(dto, { ...actor, roles: ['SUPERADMIN'] })).rejects.toThrow();
  });
  it('comprueba plantel antes de registrar', async () => {
    const { servicio, scope, repositorio } = crear();
    scope.validarGestion.mockRejectedValueOnce(new Error('Fuera de plantel'));
    await expect(servicio.registrar(dto, actor)).rejects.toThrow('Fuera de plantel');
    expect(repositorio.save).not.toHaveBeenCalled();
  });
  it('no activa al firmante por introducir metadatos', async () => {
    const { servicio } = crear();
    const resultado = await servicio.registrar(dto, actor);
    expect(resultado.estado).toBe('PENDIENTE_VALIDACION');
    expect(resultado.certificadoConfigurado).toBe(false);
    expect(resultado).not.toHaveProperty('curp');
  });
  it('rechaza nombramientos con vigencia invertida', async () => {
    const { servicio } = crear();
    await expect(servicio.registrar({ ...dto, vigenteHasta: '2025-12-31' }, actor)).rejects.toThrow();
  });
  it('desactiva sin eliminar historial', async () => {
    const { servicio, repositorio } = crear();
    const resultado = await servicio.desactivar(5, actor);
    expect(resultado.estado).toBe('INACTIVO');
    expect(repositorio.save).toHaveBeenCalled();
  });
});
