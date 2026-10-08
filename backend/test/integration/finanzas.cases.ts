import { ContextoIntegracion } from './contexto';
import { CobranzaService } from '../../src/finanzas/cobranza.service';
import { NotificacionesService } from '../../src/notificaciones/notificaciones.service';
import { expect, it, jest } from '@jest/globals';
import * as ExcelJS from 'exceljs';
import { BitacoraFinanciera } from '../../src/entities/bitacora-financiera.entity';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { Alumno, Cargo, CicloEscolar, ConceptoPago, GrupoMateria, PlantillaCorreo, CobranzaEnvio, Notificacion, OrdenPago, Pago, Plantel, Usuario } from '../../src/entities';
import { BitacoraFinancieraService } from '../../src/finanzas/bitacora-financiera.service';
export const casos_finanzas: Record<number, (ctx: ContextoIntegracion) => void> = {
  14: (ctx) => {
it('genera una sola colegiatura si dos solicitudes llegan simultaneamente', async () => {
    const admin = await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.adminId });
    const token = await ctx.emitirToken(admin.email);
    const ciclo = await ctx.dataSource.getRepository(CicloEscolar).findOneByOrFail({ clave: `C${ctx.sufijo}` });
    const conceptos = ctx.dataSource.getRepository(ConceptoPago);
    const concepto = await conceptos.save(conceptos.create({
      clave: 'COL', nombre: 'Colegiatura integracion', tipo: 'COLEGIATURA', montoBase: 100,
    }));
    const body = { cicloId: ciclo.id, periodo: '2026-09', monto: 100, plantelId: ctx.plantelId, confirmado: true };
    const [primera, segunda] = await Promise.all([
      ctx.api('/finanzas/cargos/generar-colegiaturas', { method: 'POST', token, body }),
      ctx.api('/finanzas/cargos/generar-colegiaturas', { method: 'POST', token, body }),
    ]);

    expect(primera.response.status).toBe(201);
    expect(segunda.response.status).toBe(201);
    expect(primera.data.generados + segunda.data.generados).toBe(2);
    expect(await ctx.dataSource.getRepository(Cargo).countBy({
      conceptoId: concepto.id,
      cicloId: ciclo.id,
      periodo: '2026-09',
    })).toBe(2);
    expect(await ctx.dataSource.getRepository(Cargo).countBy({
      claveGeneracion: `COLEGIATURA:${ciclo.id}:${ctx.alumnoId}:2026-09`,
    })).toBe(1);
  });
  },
  15: (ctx) => {
it('evita pago manual sobre una orden pendiente y deduplica webhooks concurrentes', async () => {
    const orden = await ctx.dataSource.getRepository(OrdenPago).findOneByOrFail({ id: ctx.ordenId });
    const admin = await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.adminId });
    const token = await ctx.emitirToken(admin.email);
    const pagoManual = await ctx.api('/finanzas/pagos', {
      method: 'POST', token,
      body: {
        alumnoId: ctx.alumnoId, cargoId: ctx.cargoWebhookId, monto: 125, metodo: 'EFECTIVO',
        referencia: `MAN${ctx.sufijo}`, claveIdempotencia: randomUUID(),
      },
    });
    expect(pagoManual.response.status).toBe(409);

    const evento = { type: 'charge.succeeded', transaction: {
      id: orden.idExterno, order_id: `ORD-${orden.id}`, amount: 125,
      currency: 'MXN', transaction_type: 'charge', status: 'completed',
    } };
    const [primera, segunda] = await Promise.all([
      ctx.api('/finanzas/webhook/openpay', { method: 'POST', body: evento }),
      ctx.api('/finanzas/webhook/openpay', { method: 'POST', body: evento }),
    ]);

    expect(primera.response.status).toBe(200);
    expect(segunda.response.status).toBe(200);
    expect(await ctx.dataSource.getRepository(Pago).countBy({ ordenPagoId: ctx.ordenId })).toBe(1);
    expect(await ctx.dataSource.getRepository(Notificacion).countBy({ usuarioId: ctx.alumnoUsuarioId })).toBe(1);
    expect((await ctx.dataSource.getRepository(OrdenPago).findOneByOrFail({ id: ctx.ordenId })).estatus).toBe('COMPLETADA');
    expect((await ctx.dataSource.getRepository(Cargo).findOneByOrFail({ id: ctx.cargoWebhookId })).estatus).toBe('PAGADO');
  });
  },
  16: (ctx) => {
it('acepta pagos parciales y rechaza exceder el saldo restante', async () => {
    const admin = await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.adminId });
    const token = await ctx.emitirToken(admin.email);
    const concepto = await ctx.api('/finanzas/conceptos', {
      method: 'POST', token,
      body: { clave: `FM${ctx.sufijo}`, nombre: 'Cargo manual integración', tipo: 'COLEGIATURA', montoBase: 200 },
    });
    expect(concepto.response.status).toBe(201);
    const cargo = await ctx.api('/finanzas/cargos', {
      method: 'POST', token,
      body: {
        alumnoId: ctx.alumnoId, conceptoId: concepto.data.id, descripcion: 'Cargo manual', monto: 200,
        descuento: 0, fechaVencimiento: '2027-06-01',
      },
    });
    expect(cargo.response.status).toBe(201);

    const claveParcial = randomUUID();
    const parcial = await ctx.api('/finanzas/pagos', {
      method: 'POST', token,
      body: {
        alumnoId: ctx.alumnoId, cargoId: cargo.data.id, monto: 50, metodo: 'TRANSFERENCIA',
        referencia: `INT${ctx.sufijo}`, claveIdempotencia: claveParcial,
      },
    });
    expect(parcial.response.status).toBe(201);
    const reintento = await ctx.api('/finanzas/pagos', {
      method: 'POST', token,
      body: {
        alumnoId: ctx.alumnoId, cargoId: cargo.data.id, monto: 50, metodo: 'TRANSFERENCIA',
        referencia: `INT${ctx.sufijo}`, claveIdempotencia: claveParcial,
      },
    });
    expect(reintento.response.status).toBe(201);
    expect(reintento.data.id).toBe(parcial.data.id);
    const claveReutilizada = await ctx.api('/finanzas/pagos', {
      method: 'POST', token,
      body: {
        alumnoId: ctx.alumnoId, cargoId: cargo.data.id, monto: 60, metodo: 'TRANSFERENCIA',
        referencia: `INT${ctx.sufijo}`, claveIdempotencia: claveParcial,
      },
    });
    expect(claveReutilizada.response.status).toBe(409);
    const excedente = await ctx.api('/finanzas/pagos', {
      method: 'POST', token,
      body: {
        alumnoId: ctx.alumnoId, cargoId: cargo.data.id, monto: 150.01, metodo: 'EFECTIVO',
        referencia: `EXC${ctx.sufijo}`, claveIdempotencia: randomUUID(),
      },
    });
    expect(excedente.response.status).toBe(400);
    expect((await ctx.dataSource.getRepository(Cargo).findOneByOrFail({ id: cargo.data.id })).estatus).toBe('PARCIAL');
    expect(await ctx.dataSource.getRepository(Pago).countBy({ cargoId: cargo.data.id })).toBe(1);
  });
  },
  17: (ctx) => {
it('revierte cargos y recargos cuando falla su bitácora financiera', async () => {
    const admin = await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.adminId });
    const token = await ctx.emitirToken(admin.email);
    const concepto = await ctx.dataSource.getRepository(ConceptoPago).save(
      ctx.dataSource.getRepository(ConceptoPago).create({
        aplicaRecargo: true, clave: `TX${ctx.sufijo}`, nombre: 'Concepto transaccional', tipo: 'OTRO', montoBase: 100,
      }),
    );
    const bitacora = ctx.app.get(BitacoraFinancieraService);
    const descripcion = `Cargo reversible ${ctx.sufijo}`;
    const fallo = jest.spyOn(bitacora, 'registrar').mockRejectedValueOnce(new Error('Bitácora no disponible'));
    try {
      const respuesta = await ctx.api('/finanzas/cargos', {
        method: 'POST', token,
        body: { alumnoId: ctx.alumnoId, conceptoId: concepto.id, descripcion, monto: 100, descuento: 0 },
      });
      expect(respuesta.response.status).toBe(500);
      expect(await ctx.dataSource.getRepository(Cargo).countBy({ descripcion })).toBe(0);
    } finally {
      fallo.mockRestore();
    }

    const creado = await ctx.api('/finanzas/cargos', {
      method: 'POST', token,
      body: {
        alumnoId: ctx.alumnoId, conceptoId: concepto.id, descripcion, monto: 100,
        descuento: 0, fechaVencimiento: '2020-01-01',
      },
    });
    expect(creado.response.status).toBe(201);
    const falloRecargo = jest.spyOn(bitacora, 'registrar').mockRejectedValueOnce(new Error('Bitácora no disponible'));
    try {
      const respuesta = await ctx.api('/finanzas/cargos/aplicar-recargos', {
        method: 'POST', token, body: { plantelId: ctx.plantelId, porcentaje: 10, confirmado: true },
      });
      expect(respuesta.response.status).toBe(500);
      const cargo = await ctx.dataSource.getRepository(Cargo).findOneByOrFail({ id: creado.data.id });
      expect(cargo.recargo).toBe(0);
      expect(cargo.estatus).toBe('PENDIENTE');
    } finally {
      falloRecargo.mockRestore();
    }
  });
  },
  28: (ctx) => {
it('cancela cargos y anula pagos manuales con auditoría y recálculo del saldo', async () => {
    const token = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.finanzasId })).email);
    const concepto = await ctx.dataSource.getRepository(ConceptoPago).findOneOrFail({ where: { activo: true } });
    const nuevo = await ctx.api('/finanzas/cargos', { method: 'POST', token, body: { alumnoId: ctx.alumnoId, conceptoId: concepto.id, descripcion: 'Cargo reversible', monto: 50 } });
    expect(nuevo.response.status).toBe(201);
    const cargoId = nuevo.data.id;
    expect((await ctx.api('/finanzas/pagos', { method: 'POST', token, body: { alumnoId: ctx.alumnoId, monto: 50, metodo: 'EFECTIVO', claveIdempotencia: randomUUID() } })).response.status).toBe(400);
    const pago = await ctx.api('/finanzas/pagos', { method: 'POST', token, body: { alumnoId: ctx.alumnoId, cargoId, monto: 50, metodo: 'EFECTIVO', claveIdempotencia: randomUUID() } });
    expect(pago.response.status).toBe(201);
    expect((await ctx.dataSource.getRepository(Cargo).findOneByOrFail({ id: cargoId })).estatus).toBe('PAGADO');
    expect((await ctx.api(`/finanzas/cargos/${cargoId}/cancelacion`, { method: 'POST', token, body: { motivo: 'Error de captura' } })).response.status).toBe(409);
    expect((await ctx.api(`/finanzas/pagos/${pago.data.id}/anulacion`, { method: 'POST', token, body: { motivo: 'Error comprobado' } })).response.status).toBe(201);
    expect((await ctx.dataSource.getRepository(Cargo).findOneByOrFail({ id: cargoId })).estatus).toBe('PENDIENTE');
    expect((await ctx.api(`/finanzas/cargos/${cargoId}/cancelacion`, { method: 'POST', token, body: { motivo: 'Error de captura' } })).response.status).toBe(201);
    expect(await ctx.dataSource.getRepository(BitacoraFinanciera).countBy({ accion: 'ANULAR_PAGO', entidadId: pago.data.id, usuarioId: ctx.finanzasId })).toBe(1);
    expect(await ctx.dataSource.getRepository(BitacoraFinanciera).countBy({ accion: 'CANCELAR_CARGO', entidadId: cargoId, usuarioId: ctx.finanzasId })).toBe(1);
  });
  },
  37: (ctx) => {
it('recargos respetan la política desactivada por defecto y descuentan beca del cargo', async () => {
    const token = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.adminId })).email);
    const concepto = await ctx.api('/finanzas/conceptos', { method: 'POST', token, body: { clave: `POL${ctx.sufijo}`, nombre: 'Concepto sin recargo', tipo: 'OTRO', montoBase: 100 } }); expect(concepto.response.status).toBe(201); expect(concepto.data.aplicaRecargo).toBe(false);
    const cargo = await ctx.api('/finanzas/cargos', { method: 'POST', token, body: { alumnoId: ctx.alumnoId, conceptoId: concepto.data.id, descripcion: 'Cargo de política', monto: 100, descuento: 20, fechaVencimiento: '2020-01-01' } }); expect(cargo.response.status).toBe(201);
    expect((await ctx.api('/finanzas/cargos/aplicar-recargos', { method: 'POST', token, body: { plantelId: ctx.plantelId, porcentaje: 10, confirmado: true } })).response.status).toBe(201);
    expect((await ctx.dataSource.getRepository(Cargo).findOneByOrFail({ id: cargo.data.id })).recargo).toBe(0);
    expect((await ctx.api(`/finanzas/conceptos/${concepto.data.id}`, { method: 'PATCH', token, body: { aplicaRecargo: true } })).response.status).toBe(200);
    expect((await ctx.api('/finanzas/cargos/aplicar-recargos', { method: 'POST', token, body: { plantelId: ctx.plantelId, porcentaje: 10, confirmado: true } })).response.status).toBe(201);
    expect((await ctx.dataSource.getRepository(Cargo).findOneByOrFail({ id: cargo.data.id })).recargo).toBe(8);
    expect((await ctx.api('/finanzas/conceptos', { method: 'POST', token, body: { clave: `BE${ctx.sufijo}`, nombre: 'Beca no es deuda', tipo: 'BECA', montoBase: 100 } })).response.status).toBe(400);
  });
  },
  39: (ctx) => {
it('migra el origen de cargos, órdenes y pagos existentes desde su primera bitácora', async () => {
    const origen = await ctx.dataSource.getRepository(Plantel).findOneByOrFail({ clave: 'MIGRACION_FIXTURE' });
    const alumno = await ctx.dataSource.getRepository(Alumno).findOneByOrFail({ matricula: 'MIGRACION_LEDGER' });
    expect(alumno.plantelId).not.toBe(origen.id);
    const cargo = await ctx.dataSource.getRepository(Cargo).findOneByOrFail({ descripcion: 'LEDGER_PREVIO' });
    const orden = await ctx.dataSource.getRepository(OrdenPago).findOneByOrFail({ cargoId: cargo.id });
    const pago = await ctx.dataSource.getRepository(Pago).findOneByOrFail({ cargoId: cargo.id });
    expect([cargo.plantelId, orden.plantelId, pago.plantelId]).toEqual([origen.id, origen.id, origen.id]);
  });
  },
  40: (ctx) => {
it('mantiene cargos, pagos, permisos y analítica en el plantel de origen después de transferir', async () => {
    const root = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.superadminId })).email);
    const a = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.adminId })).email);
    const b = await ctx.emitirFinanzasB();
    const alta = await ctx.api('/alumnos', { method: 'POST', token: root, body: { email: `origen_${ctx.sufijo}@example.invalid`, password: 'Integracion_Segura_42!', nombre: 'Origen', apellidoPaterno: 'Financiero', matricula: `OF${ctx.sufijo}`, plantelId: ctx.plantelId } }); expect(alta.response.status).toBe(201);
    const clase = await ctx.dataSource.getRepository(GrupoMateria).findOneByOrFail({ id: ctx.grupoMateriaIdMaestro });
    const concepto = await ctx.dataSource.getRepository(ConceptoPago).findOneByOrFail({ clave: `CW${ctx.sufijo}` });
    const cargo = await ctx.api('/finanzas/cargos', { method: 'POST', token: a, body: { alumnoId: alta.data.id, conceptoId: concepto.id, cicloId: clase.grupo.cicloId, descripcion: 'Origen inmutable', monto: 100 } }); expect(cargo.response.status).toBe(201);
    const transfer = await ctx.api(`/alumnos/${alta.data.id}/transferencia`, { method: 'POST', token: root, body: { plantelId: ctx.otroPlantelId, motivo: 'Cambio de sede' } }); expect(transfer.response.status).toBe(201);
    const dto = { alumnoId: alta.data.id, cargoId: cargo.data.id, monto: 20, metodo: 'EFECTIVO', claveIdempotencia: randomUUID() };
    expect((await ctx.api('/finanzas/pagos', { method: 'POST', token: b, body: dto })).response.status).toBe(403);
    const pago = await ctx.api('/finanzas/pagos', { method: 'POST', token: a, body: dto }); expect(pago.response.status).toBe(201); expect(pago.data.plantelId).toBe(ctx.plantelId);
    const buscador = await ctx.api(`/finanzas/alumnos?buscar=OF${ctx.sufijo}`, { token: a }); expect(buscador.response.status).toBe(200); expect(buscador.data.datos).toHaveLength(1); expect(JSON.stringify(buscador.data)).not.toContain('@example.invalid');
    const cuentaA = await ctx.api(`/finanzas/alumnos/${alta.data.id}/estado-cuenta`, { token: a }); expect(cuentaA.response.status).toBe(200); expect(cuentaA.data.saldoTotal).toBe(80);
    const cuentaB = await ctx.api(`/finanzas/alumnos/${alta.data.id}/estado-cuenta`, { token: b }); expect(cuentaB.response.status).toBe(200); expect(cuentaB.data.cargos).toEqual([]); expect(cuentaB.data.pagos).toEqual([]);
    expect((await ctx.api(`/finanzas/pagos/${pago.data.id}/anulacion`, { method: 'POST', token: b, body: { motivo: 'Fuera del alcance' } })).response.status).toBe(403);
    expect((await ctx.api(`/finanzas/pagos/${pago.data.id}/anulacion`, { method: 'POST', token: a, body: { motivo: 'Corrección autorizada' } })).response.status).toBe(201);
    expect((await ctx.dataSource.getRepository(Cargo).findOneByOrFail({ id: cargo.data.id })).plantelId).toBe(ctx.plantelId);
  });
  },
  43: (ctx) => {
it('cobranza deduplica, conserva éxito parcial y exige revisión de timeout antes de reenviar', async () => {
    const usuario = await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.adminId }); const token = await ctx.emitirToken(usuario.email);
    await ctx.dataSource.getRepository(PlantillaCorreo).save({ clave: 'AVISO_ADEUDO', asunto: 'Aviso {{institucion}}', cuerpoHtml: '<p>{{nombre}} {{saldo}}</p>' });
    const servicio = ctx.app.get(CobranzaService);
    const primera = await ctx.api('/finanzas/avisos-cobranza', { method: 'POST', token, body: { plantelId: ctx.plantelId, confirmado: true } }); expect(primera.response.status).toBe(201); expect(primera.data.programados).toBeGreaterThan(0);
    const repetida = await ctx.api('/finanzas/avisos-cobranza', { method: 'POST', token, body: { plantelId: ctx.plantelId, confirmado: true } }); expect(repetida.data.programados).toBe(0);
    await ctx.dataSource.getRepository(CobranzaEnvio).update({ estado: 'PENDIENTE' }, { proximoIntento: new Date(0) });
    const smtp = jest.spyOn(ctx.app.get(NotificacionesService), 'enviarEmail').mockResolvedValueOnce({ simulado: false }).mockRejectedValueOnce(new Error('Timeout después de DATA')).mockResolvedValue({ simulado: false });
    await servicio.procesar(); const cantidad = smtp.mock.calls.length; expect(cantidad).toBeGreaterThan(1); await servicio.procesar(); expect(smtp).toHaveBeenCalledTimes(cantidad); smtp.mockRestore();
    expect(await ctx.dataSource.getRepository(CobranzaEnvio).countBy({ estado: 'ENVIADO' })).toBeGreaterThan(0);
    const incierto = await ctx.dataSource.getRepository(CobranzaEnvio).findOneByOrFail({ estado: 'INCIERTO' });
    const b = await ctx.emitirFinanzasB();
    expect((await ctx.api(`/finanzas/cobranza/envios/${incierto.id}/reintento`, { method: 'POST', token: b, body: { motivo: 'Intento no autorizado', confirmado: true } })).response.status).toBe(403);
    expect((await ctx.api(`/finanzas/cobranza/envios/${incierto.id}/reintento`, { method: 'POST', token, body: { motivo: 'Revisado con proveedor', confirmado: false } })).response.status).toBe(400);
    expect((await ctx.api(`/finanzas/cobranza/envios/${incierto.id}/reintento`, { method: 'POST', token, body: { motivo: 'Proveedor confirmó que no recibió', confirmado: true } })).response.status).toBe(201);
    const repo = ctx.dataSource.getRepository(CobranzaEnvio);
    const rechazo = jest.spyOn(ctx.app.get(NotificacionesService), 'enviarEmail').mockRejectedValue(Object.assign(new Error('Rechazo temporal'), { responseCode: 450 }));
    try {
      for (let intento = 1; intento <= 3; intento++) {
        await repo.update(incierto.id, { proximoIntento: new Date(0) }); await servicio.procesar();
        const actual = await repo.findOneByOrFail({ id: incierto.id });
        expect(actual.intentos).toBe(intento); expect(actual.estado).toBe(intento < 3 ? 'PENDIENTE' : 'ERROR');
      }
      await servicio.procesar(); expect(rechazo).toHaveBeenCalledTimes(3);
      // Un proceso interrumpido debe conservar el resultado incierto y auditarlo sin reenviar.
      await repo.update(incierto.id, { estado: 'ENVIANDO', proximoIntento: new Date(0) }); await servicio.procesar();
      expect((await repo.findOneByOrFail({ id: incierto.id })).estado).toBe('INCIERTO'); expect(rechazo).toHaveBeenCalledTimes(3);
      expect(await ctx.dataSource.getRepository(BitacoraFinanciera).existsBy({ accion: 'COBRANZA_INCIERTO', entidadId: incierto.id, detalle: 'ENVIO_INTERRUMPIDO_VERIFICAR_PROVEEDOR' })).toBe(true);
    } finally { rechazo.mockRestore(); }
  });
  },
};
