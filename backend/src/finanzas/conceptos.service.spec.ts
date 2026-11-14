import { ConflictException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { ConceptoPago } from '../entities/concepto-pago.entity';
import { stub } from '../test-utils/stub';
import { ConceptosService } from './conceptos.service';

describe('ConceptosService.actualizar: integridad del tipo financiero', () => {
  const existente = {
    id: 9,
    clave: 'COL9',
    nombre: 'Colegiatura de prueba',
    tipo: 'COLEGIATURA' as const,
    montoBase: 1000,
    aplicaRecargo: false,
    activo: true,
    legacyId: null,
  };

  function preparar() {
    const findOne = jest.fn().mockResolvedValue(existente);
    const update = jest.fn().mockResolvedValue({ affected: 1 });
    const servicio = new ConceptosService(stub<Repository<ConceptoPago>>({ findOne, update }));
    return { servicio, findOne, update };
  }

  it('rechaza reclasificar un concepto para evitar reinterpretar cargos y cuotas', async () => {
    const { servicio, update } = preparar();
    await expect(servicio.actualizar(9, { tipo: 'OTRO' })).rejects.toBeInstanceOf(ConflictException);
    expect(update).not.toHaveBeenCalled();
  });

  it('permite corregir nombre y monto sin cambiar tipo', async () => {
    const { servicio, update } = preparar();
    await expect(servicio.actualizar(9, {
      nombre: 'Colegiatura autorizada',
      montoBase: 1200,
      tipo: 'COLEGIATURA',
    })).resolves.toMatchObject({ id: 9, tipo: 'COLEGIATURA' });
    expect(update).toHaveBeenCalledWith(9, { nombre: 'Colegiatura autorizada', montoBase: 1200 });
  });

  it('no reescribe el registro cuando solo se envía el mismo tipo', async () => {
    const { servicio, update } = preparar();
    await expect(servicio.actualizar(9, { tipo: 'COLEGIATURA' })).resolves.toMatchObject({ id: 9 });
    expect(update).not.toHaveBeenCalled();
  });

  it('conserva el resto del catálogo modificable al desactivarlo', async () => {
    const { servicio, update } = preparar();
    await servicio.actualizar(9, { activo: false });
    expect(update).toHaveBeenCalledWith(9, { activo: false });
  });

  it('permite corregir descripciones de un RECARGO legado sin enviar un tipo prohibido', async () => {
    const findOne = jest.fn().mockResolvedValue({ ...existente, tipo: 'RECARGO' });
    const update = jest.fn().mockResolvedValue({ affected: 1 });
    const servicio = new ConceptosService(stub<Repository<ConceptoPago>>({ findOne, update }));
    await servicio.actualizar(9, { nombre: 'Recargo histórico' });
    expect(update).toHaveBeenCalledWith(9, { nombre: 'Recargo histórico' });
  });
});
