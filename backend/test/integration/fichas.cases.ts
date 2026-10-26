import { expect, it } from '@jest/globals';
import { randomUUID } from 'crypto';
import { Cargo, Pago, Usuario } from '../../src/entities';
import { CuentaDeposito } from '../../src/entities/cuenta-deposito.entity';
import { identificadorFicha } from '../../src/finanzas/fichas.service';
import { ContextoIntegracion } from './contexto';

export function registrarFichas(ctx: ContextoIntegracion) {
  it('serializa el mismo folio en cargos distintos y conserva el reintento', async () => {
    // Solo fixtures en la BD descartable: no se consulta ningún banco/proveedor.
    await ctx.dataSource.getRepository(CuentaDeposito).save({ id: 1, banco: 'BBVA',
      titular: 'CUENTA SINTETICA DE INTEGRACION', numeroCuenta: '0000000000', clabe: null, activo: true });
    const finanzas = await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.finanzasId });
    const token = await ctx.emitirToken(finanzas.email);
    const repo = ctx.dataSource.getRepository(Cargo);
    const origen = await repo.findOneByOrFail({ id: ctx.cargoWebhookId });
    const cargos = await Promise.all([1, 2].map(i => repo.save(repo.create({
      alumnoId: origen.alumnoId, plantelId: origen.plantelId, conceptoId: origen.conceptoId,
      cicloId: null, periodo: null, descripcion: `Ficha concurrente ${i}`, monto: 100,
      descuento: 0, recargo: 0, fechaVencimiento: null, estatus: 'PENDIENTE',
    }))));
    const folio = `FICHA-${ctx.sufijo}`;
    const solicitudes = cargos.map(cargo => ({ identificador: identificadorFicha(cargo.id),
      claveIdempotencia: randomUUID(), monto: 50, metodo: 'TRANSFERENCIA', referenciaBancaria: folio, confirmado: true }));
    const enviar = (body: typeof solicitudes[number]) => ctx.api('/finanzas/fichas/registrar', { method: 'POST', token, body });
    const resultados = await Promise.all(solicitudes.map(enviar));
    expect(resultados.map(r => r.response.status).sort()).toEqual([201, 409]);
    expect(await ctx.dataSource.getRepository(Pago).countBy({ referencia: folio, estatus: 'CONFIRMADO' })).toBe(1);
    const indice = resultados.findIndex(r => r.response.status === 201);
    const repetido = await enviar(solicitudes[indice]);
    expect(repetido.response.status).toBe(201);
    expect(repetido.data.pagoId).toBe(resultados[indice].data.pagoId);
    expect(await ctx.dataSource.getRepository(Pago).countBy({ referencia: folio, estatus: 'CONFIRMADO' })).toBe(1);
    const ajeno = await ctx.emitirFinanzasB();
    expect((await ctx.api(`/finanzas/fichas/${cargos[0].id}`, { token: ajeno })).response.status).toBe(403);
  });
}
