import { curpFicticia } from './identidad-ficticia';
import { expect, it } from '@jest/globals';
import { randomUUID } from 'crypto';
import { Cargo, CarreraPlan, CicloEscolar, ConceptoPago, Grupo, Inscripcion, NivelAcademico, PeriodoAcademico, ProgramacionCobro, Usuario } from '../../src/entities';
import { ContextoIntegracion } from './contexto';

export function registrarProgramacionesCobro(ctx: ContextoIntegracion) {
  it('confirma, emite y compite con COL sin duplicar cargos ni cruzar planteles', async () => {
    const ds = ctx.dataSource;
    const token = await ctx.emitirToken((await ds.getRepository(Usuario).findOneByOrFail({ id: ctx.adminId })).email);
    const fin = await ctx.emitirToken((await ds.getRepository(Usuario).findOneByOrFail({ id: ctx.finanzasId })).email);
    const alta = await ctx.api('/alumnos', { method: 'POST', token, body: {
      email: `programacion_${ctx.sufijo}@example.invalid`, nombre: 'Alumno', apellidoPaterno: 'Sintético',
      matricula: `PG${ctx.sufijo}`, plantelId: ctx.plantelId, curp: curpFicticia(),
    } });
    expect(alta.response.status).toBe(201);
    const alumnoId = alta.data.id as number;
    const ciclo = await ds.getRepository(CicloEscolar).save({ clave: `PG${ctx.sufijo}`, nombre: 'Ciclo sintético de cobros',
      fechaInicio: '2027-01-01', fechaFin: '2027-12-31', estado: 'ACTIVO', activo: true });
    const nivel = await ds.getRepository(NivelAcademico).save({ plantelId: ctx.plantelId, clave: `PG${ctx.sufijo}`, nombre: 'Nivel sintético', activo: true });
    const carrera = await ds.getRepository(CarreraPlan).save({ plantelId: ctx.plantelId, nivelId: nivel.id, clave: `PG${ctx.sufijo}`, nombre: 'Plan sintético', versionPlan: 'QA', activo: true });
    const periodo = await ds.getRepository(PeriodoAcademico).save({ plantelId: ctx.plantelId, carreraId: carrera.id, cicloId: ciclo.id,
      clave: 'CUAT1', nombre: 'Periodo sintético', tipo: 'CUATRIMESTRAL', numero: 1, activo: true });
    const grupo = await ds.getRepository(Grupo).save({ plantelId: ctx.plantelId, cicloId: ciclo.id, nombre: 'Grupo sintético',
      nivelId: nivel.id, carreraId: carrera.id, periodoAcademicoId: periodo.id, tipo: 'REGULAR', activo: true });
    await ds.getRepository(Inscripcion).save({ alumnoId, grupoId: grupo.id, estatus: 'ACTIVA' });
    const concepto = await ds.getRepository(ConceptoPago).save({ clave: `PG${ctx.sufijo}`, nombre: 'Colegiatura programada QA', tipo: 'COLEGIATURA', montoBase: 100, activo: true });
    const body = { alumnoId, plantelId: ctx.plantelId, cicloId: ciclo.id, periodoAcademicoId: periodo.id, conceptoId: concepto.id,
      modalidad: 'SUPERIOR', total: 400, mesInicio: '2027-01', diaVencimiento: 5, idempotencia: randomUUID(), confirmado: true };
    const confirmado = await ctx.api('/finanzas/programaciones/confirmar', { method: 'POST', token: fin, body });
    expect(confirmado.response.status).toBe(201);
    const id = confirmado.data.id as number;
    const reordenada = Object.fromEntries(Object.entries(body).reverse());
    const repetida = await ctx.api('/finanzas/programaciones/confirmar', { method: 'POST', token: fin, body: reordenada });
    expect(repetida.response.status).toBe(201); expect(repetida.data.id).toBe(id);
    expect(await ds.getRepository(ProgramacionCobro).countBy({ alumnoId })).toBe(1);
    const emitir = (numero: number) => ctx.api(`/finanzas/programaciones/${id}/cuotas/${numero}/emitir`, { method: 'POST', token: fin, body: { confirmado: true } });
    const iniciales = await Promise.all([emitir(1), emitir(1)]);
    expect(iniciales.map(r => r.response.status)).toEqual([201, 201]);
    expect(iniciales[0].data.cargoId).toBe(iniciales[1].data.cargoId);
    const [cuota, masiva] = await Promise.all([emitir(2), ctx.api('/finanzas/cargos/generar-colegiaturas', { method: 'POST', token, body: {
      plantelId: ctx.plantelId, cicloId: ciclo.id, periodo: '2027-02', monto: 100, confirmado: true,
    } })]);
    expect([201, 409]).toContain(cuota.response.status); expect(masiva.response.status).toBe(201);
    expect(await ds.getRepository(Cargo).count({ where: { alumnoId, cicloId: ciclo.id, periodo: '2027-02', concepto: { tipo: 'COLEGIATURA' } } })).toBe(1);
    // Dos ciclos del mismo alumno conservan el mismo orden de locks: no se bloquean mutuamente.
    const cicloB = await ds.getRepository(CicloEscolar).save({ clave: `PB${ctx.sufijo}`, nombre: 'Otro ciclo sintético',
      fechaInicio: '2027-01-01', fechaFin: '2027-12-31', estado: 'ACTIVO', activo: true });
    const periodoB = await ds.getRepository(PeriodoAcademico).save({ plantelId: ctx.plantelId, carreraId: carrera.id, cicloId: cicloB.id,
      clave: 'CUAT1', nombre: 'Otro periodo sintético', tipo: 'CUATRIMESTRAL', numero: 1, activo: true });
    const grupoB = await ds.getRepository(Grupo).save({ plantelId: ctx.plantelId, cicloId: cicloB.id, nombre: 'Otro grupo sintético',
      nivelId: nivel.id, carreraId: carrera.id, periodoAcademicoId: periodoB.id, tipo: 'REGULAR', activo: true });
    await ds.getRepository(Inscripcion).save({ alumnoId, grupoId: grupoB.id, estatus: 'ACTIVA' });
    const cruzados = await Promise.all([emitir(3), ctx.api('/finanzas/cargos/generar-colegiaturas', { method: 'POST', token, body: {
      plantelId: ctx.plantelId, cicloId: cicloB.id, periodo: '2027-03', monto: 100, confirmado: true,
    } })]);
    expect(cruzados.map(r => r.response.status)).toEqual([201, 201]);
    expect(await ds.getRepository(Cargo).countBy({ alumnoId, periodo: '2027-03' })).toBe(2);
    await ds.getRepository(PeriodoAcademico).update(periodo.id, { activo: false });
    expect((await emitir(4)).response.status).toBe(409);
    await ds.getRepository(PeriodoAcademico).update(periodo.id, { activo: true });
    await ds.getRepository(ConceptoPago).update(concepto.id, { tipo: 'OTRO' });
    expect((await emitir(4)).response.status).toBe(409);
    expect((await ctx.api(`/finanzas/programaciones/${id}`, { token: await ctx.emitirFinanzasB() })).response.status).toBe(403);
  });
}
