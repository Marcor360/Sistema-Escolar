import { curpFicticia } from './identidad-ficticia';
import { crearInscripcionFixture } from './fixtures-inscripcion';
import { expect, it } from '@jest/globals';
import { Alumno, Cargo, CicloEscolar, ConceptoPago, Inscripcion, Usuario } from '../../src/entities';
import { ContextoIntegracion } from './contexto';

// Recorrido sobre la BD de integración desechable: no comunica con proveedores externos.
export function registrarRecorridoInstitucional(ctx: ContextoIntegracion) {
  it('alta, activación, inscripción, colegiatura y estado de cuenta', async () => {
    const administrativo = await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.adminId });
    const tokenAdmin = await ctx.emitirToken(administrativo.email);
    const email = `institucional_${ctx.sufijo}@example.invalid`;
    const creado = await ctx.api('/alumnos', { method: 'POST', token: tokenAdmin, body: {
      email, nombre: 'Alumno', apellidoPaterno: 'Pruebas', matricula: `FL${ctx.sufijo}`,
      plantelId: ctx.plantelId, curp: curpFicticia(), correoProveedor: 'MICROSOFT365',
    } });
    expect(creado.response.status).toBe(201);
    const alumnoId = creado.data.id as number;
    const alumno = await ctx.dataSource.getRepository(Alumno).findOneByOrFail({ id: alumnoId });
    expect((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: alumno.usuarioId })).activacionPendiente).toBe(true);
    // La utilidad de integración activa usando el outbox y una clave exclusivamente sintética.
    const tokenAlumno = await ctx.emitirToken(email);
    expect((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: alumno.usuarioId })).activacionPendiente).toBe(false);
    expect((await ctx.api('/auth/me', { token: tokenAlumno })).response.status).toBe(200);

    const ciclo = await ctx.dataSource.getRepository(CicloEscolar).findOneByOrFail({ clave: `C${ctx.sufijo}` });
    expect(ciclo.activo).toBe(true);
    const grupo = await ctx.api('/academico/grupos', { method: 'POST', token: tokenAdmin, body: {
      cicloId: ciclo.id, plantelId: ctx.plantelId, nombre: `Flujo ${ctx.sufijo}`,
    } });
    expect(grupo.response.status).toBe(201);
    await crearInscripcionFixture(ctx,grupo.data.id,alumnoId);
    expect(await ctx.dataSource.getRepository(Inscripcion).countBy({
      alumnoId, grupoId: grupo.data.id, estatus: 'ACTIVA',
    })).toBe(1);

    expect((await ctx.dataSource.getRepository(ConceptoPago).findOneByOrFail({ clave: 'COL' })).tipo).toBe('COLEGIATURA');
    const datos = { cicloId: ciclo.id, plantelId: ctx.plantelId, periodo: '2026-11', monto: 375 };
    const preview = await ctx.api('/finanzas/cargos/preview-colegiaturas', {
      method: 'POST', token: tokenAdmin, body: datos,
    });
    expect(preview.response.status).toBe(201);
    expect(preview.data.registros).toBeGreaterThanOrEqual(1);
    expect(await ctx.dataSource.getRepository(Cargo).countBy({ alumnoId })).toBe(0);
    const generar = () => ctx.api('/finanzas/cargos/generar-colegiaturas', {
      method: 'POST', token: tokenAdmin, body: { ...datos, confirmado: true },
    });
    const confirmado = await generar();
    expect(confirmado.response.status).toBe(201);
    expect(confirmado.data.generados).toBeGreaterThanOrEqual(1);
    const repetido = await generar();
    expect(repetido.response.status).toBe(201);
    expect(repetido.data.generados).toBe(0);
    const claveGeneracion = `COLEGIATURA:${ciclo.id}:${alumnoId}:2026-11`;
    const cargo = await ctx.dataSource.getRepository(Cargo).findOneByOrFail({ claveGeneracion });
    expect(cargo.monto).toBe(375);
    expect(await ctx.dataSource.getRepository(Cargo).countBy({ claveGeneracion })).toBe(1);

    const propio = await ctx.api('/finanzas/me/estado-cuenta', { token: tokenAlumno });
    expect(propio.response.status).toBe(200);
    expect(propio.data.cargos).toEqual(expect.arrayContaining([expect.objectContaining({ id: cargo.id, saldo: 375 })]));
    const gestion = await ctx.api(`/finanzas/alumnos/${alumnoId}/estado-cuenta`, { token: tokenAdmin });
    expect(gestion.response.status).toBe(200);
    expect(gestion.data.cargos).toEqual(expect.arrayContaining([expect.objectContaining({ id: cargo.id, saldo: 375 })]));
    const ajeno = await ctx.emitirFinanzasB();
    expect((await ctx.api(`/finanzas/alumnos/${alumnoId}/estado-cuenta`, { token: ajeno })).response.status).toBe(403);
    expect((await ctx.api(`/finanzas/alumnos/${alumnoId}/estado-cuenta`, { token: tokenAlumno })).response.status).toBe(403);
  });
}
