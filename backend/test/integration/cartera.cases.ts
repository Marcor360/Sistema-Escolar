import { expect, it } from '@jest/globals';
import { Cargo, ConceptoPago, AperturaCartera, Grupo, Usuario, Inscripcion } from '../../src/entities';
import { ContextoIntegracion } from './contexto';
import { EntitySubscriberInterface } from 'typeorm';
import { randomUUID } from 'crypto';
export function registrarCartera(ctx: ContextoIntegracion) {
  it('cartera: cotización vigente, idempotencia, pendientes, concurrencia y rollback de cargos', async () => {
    const politicaAnterior=process.env.INSCRIPCION_ORDINARIA_SOLO_CARTERA;
    process.env.INSCRIPCION_ORDINARIA_SOLO_CARTERA='true';
    try {
    const cuenta = await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.superadminId });
    const token = await ctx.emitirToken(cuenta.email), user = { sub: cuenta.id, email: cuenta.email, nombre: 'QA', roles: ['SUPERADMIN'] };
    const post = async (ruta: string, body: unknown) => { const r = await ctx.api(ruta, { method: 'POST', token, body }); expect(r.response.status).toBe(201); return r.data; };
    const ciclo = await post('/academico/ciclos', { clave: `AC${ctx.sufijo}`, nombre: 'Ciclo cartera', fechaInicio: '2054-01-01', fechaFin: '2054-12-31' });
    const nivel = await post('/academico/catalogos/niveles', { plantelId: ctx.plantelId, clave: `AC${ctx.sufijo}`, nombre: 'Nivel cartera' });
    const carrera = await post('/academico/catalogos/carreras', { plantelId: ctx.plantelId, nivelId: nivel.id, clave: `AC${ctx.sufijo}`, nombre: 'Plan cartera', versionPlan: 'QA' });
    const periodo = await post('/academico/catalogos/periodos', { plantelId: ctx.plantelId, carreraId: carrera.id, cicloId: ciclo.id, clave: 'P1', nombre: 'Primer periodo', tipo: 'ANUAL', numero: 1 });
    const d = { plantelId: ctx.plantelId, cicloId: ciclo.id, nivelId: nivel.id, carreraId: carrera.id, periodoAcademicoId: periodo.id, turno: 'MATUTINO' as const };
    const alumnos: { id: number }[] = [];
    for (let n = 0; n < 6; n++) alumnos.push(await post('/alumnos', { email: `ac${n}${ctx.sufijo}@example.invalid`, matricula: `AC${n}${ctx.sufijo}`, nombre: 'Alumno', apellidoPaterno: `Cartera ${n}`, curp: 'GODE561231HDFRRN09', plantelId: ctx.plantelId }));
    const concepto = await ctx.dataSource.getRepository(ConceptoPago).save({ clave: `AC${ctx.sufijo}`, nombre: 'Tarifa cartera QA', tipo: 'INSCRIPCION', montoBase: 125, activo: true, aplicaRecargo: false });
    const base = { ...d, conceptoIds: [concepto.id], periodo: '2054-02', fechaVencimiento: '2054-02-05' };
    const preview = async (n: number) => { const r = await ctx.api('/cartera/previsualizar', { method: 'POST', token, body: { ...base, alumnoId: alumnos[n].id } }); expect(r.response.status).toBe(201); return r.data; };
    const confirmado = async (n: number) => ({ ...base, alumnoId: alumnos[n].id, cotizacion: (await preview(n)).cotizacion, idempotencia: randomUUID(), confirmado: true });
    const ajeno = await ctx.emitirFinanzasB();
    expect((await ctx.api('/cartera', { token: ajeno })).response.status).toBe(403);
    const q = await preview(0); expect(q.total).toBe(125);
    const cambiado = await confirmado(0);
    await ctx.dataSource.getRepository(ConceptoPago).update(concepto.id, { montoBase: 130 });
    expect((await ctx.api('/cartera/confirmar', { method: 'POST', token, body: cambiado })).response.status).toBe(409);
    await ctx.dataSource.getRepository(ConceptoPago).update(concepto.id, { montoBase: 125 });
    const primero = await confirmado(0);
    const manipulado = await ctx.api('/cartera/confirmar', { method: 'POST', token, body: { ...primero, monto: 1 } });
    expect(manipulado.response.status).toBe(201); expect(manipulado.data.conceptos[0].monto).toBe(125);
    const dobles = await Promise.all([0,1].map(() => ctx.api('/cartera/confirmar', { method: 'POST', token, body: primero })));
    expect(dobles.map(r=>r.response.status)).toEqual([201,201]); expect(dobles[0].data.id).toBe(dobles[1].data.id);
    expect(dobles[0].data.estado).toBe('PENDIENTE');
    for (let n=1;n<4;n++) expect((await ctx.api('/cartera/confirmar', { method: 'POST', token, body: await confirmado(n) })).data.estado).toBe('PENDIENTE');
    expect(await ctx.dataSource.getRepository(Cargo).countBy({ cicloId: ciclo.id })).toBe(0);
    const quinta = await confirmado(4);
    const falla: EntitySubscriberInterface<Cargo> = { listenTo: () => Cargo, beforeInsert: e => { if (e.entity.cicloId === ciclo.id) throw Error('Fallo sintético de cargo'); } };
    ctx.dataSource.subscribers.push(falla);
    try { expect((await ctx.api('/cartera/confirmar', { method: 'POST', token, body: quinta })).response.status).toBe(500); }
    finally { ctx.dataSource.subscribers.splice(ctx.dataSource.subscribers.indexOf(falla),1); }
    expect(await ctx.dataSource.getRepository(AperturaCartera).countBy({ cicloId: ciclo.id })).toBe(4);
    expect(await ctx.dataSource.getRepository(Grupo).countBy({ cicloId: ciclo.id })).toBe(0);
    expect(await ctx.dataSource.getRepository(Cargo).countBy({ cicloId: ciclo.id })).toBe(0);
    const abierta = await ctx.api('/cartera/confirmar', { method: 'POST', token, body: quinta }); expect(abierta.response.status).toBe(201); expect(abierta.data.estado).toBe('ABIERTA');
    expect(await ctx.dataSource.getRepository(Cargo).countBy({ cicloId: ciclo.id })).toBe(5);
    expect(await ctx.dataSource.getRepository(AperturaCartera).countBy({ cicloId: ciclo.id, estado: 'ABIERTA' })).toBe(5);
    const grupoAsignado=await ctx.dataSource.getRepository(Grupo).findOneByOrFail({cicloId:ciclo.id});
    const directa=await ctx.api(`/academico/grupos/${grupoAsignado.id}/alumnos`,{method:'POST',token,body:{alumnoId:alumnos[5].id}});
    expect(directa.response.status).toBe(409);expect(directa.data.message).toContain('requieren Apertura de cartera');
    const inscripcionPrevia=await ctx.dataSource.getRepository(Inscripcion).findOneByOrFail({grupoId:grupoAsignado.id,alumnoId:alumnos[0].id});
    expect((await ctx.api(`/academico/inscripciones/${inscripcionPrevia.id}`,{method:'DELETE',token})).response.status).toBe(200);
    expect((await ctx.api(`/academico/grupos/${grupoAsignado.id}/alumnos`,{method:'POST',token,body:{alumnoId:alumnos[0].id,motivo:'Reactivar inscripción documentada sin alterar cargos',documentoRef:'ACTA-REACT-2026'}})).response.status).toBe(201);
    expect(await ctx.dataSource.getRepository(Inscripcion).countBy({grupoId:grupoAsignado.id,alumnoId:alumnos[0].id,estatus:'ACTIVA'})).toBe(1);
    expect(await ctx.dataSource.getRepository(Cargo).countBy({cicloId:ciclo.id})).toBe(5);
    const retry = await ctx.api('/cartera/confirmar', { method: 'POST', token, body: quinta }); expect(retry.data.id).toBe(abierta.data.id);
    expect(await ctx.dataSource.getRepository(Cargo).countBy({ cicloId: ciclo.id })).toBe(5);
    expect((await ctx.api('/cartera/confirmar', { method: 'POST', token, body: { ...quinta, conceptoIds: [999999] } })).response.status).toBe(409);
    const listado = await ctx.api(`/cartera?buscar=AC0${ctx.sufijo}`, { token }); expect(listado.data).toMatchObject({ porPagina: 10, total: 1 });
    const alumnoToken = await ctx.emitirToken(`ac0${ctx.sufijo}@example.invalid`); expect((await ctx.api(`/cartera/${abierta.data.id}`, { token: alumnoToken })).response.status).toBe(403);
    } finally {
      if(politicaAnterior===undefined)delete process.env.INSCRIPCION_ORDINARIA_SOLO_CARTERA;
      else process.env.INSCRIPCION_ORDINARIA_SOLO_CARTERA=politicaAnterior;
    }
  });
}
