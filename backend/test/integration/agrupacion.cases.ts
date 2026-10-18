import { expect, it } from '@jest/globals';
import { AgrupacionRegularService } from '../../src/academico/agrupacion-regular.service';
import { Grupo, Inscripcion, SolicitudGrupoRegular, Usuario } from '../../src/entities';
import { ContextoIntegracion } from './contexto';
export function registrarAgrupacion(ctx: ContextoIntegracion) {
  it('agrupación ordinaria: 4 pendientes, quinto alumno, rollback, cupo y aislamiento', async () => {
    const cuenta = await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.superadminId });
    const token = await ctx.emitirToken(cuenta.email), user = { sub: cuenta.id, email: cuenta.email, nombre: 'QA', roles: ['SUPERADMIN'] };
    const post = async (ruta: string, body: unknown) => { const r = await ctx.api(ruta, { method: 'POST', token, body }); expect(r.response.status).toBe(201); return r.data; };
    const ciclo = await post('/academico/ciclos', { clave: `AG${ctx.sufijo}`, nombre: 'Ciclo agrupación', fechaInicio: '2053-01-01', fechaFin: '2053-12-31' });
    const nivel = await post('/academico/catalogos/niveles', { plantelId: ctx.plantelId, clave: `AG${ctx.sufijo}`, nombre: 'Nivel agrupación' });
    const carrera = await post('/academico/catalogos/carreras', { plantelId: ctx.plantelId, nivelId: nivel.id, clave: `AG${ctx.sufijo}`, nombre: 'Plan agrupación', versionPlan: 'QA' });
    const periodo = await post('/academico/catalogos/periodos', { plantelId: ctx.plantelId, carreraId: carrera.id, cicloId: ciclo.id, clave: 'P1', nombre: 'Primer periodo', tipo: 'ANUAL', numero: 1 });
    const d = { plantelId: ctx.plantelId, cicloId: ciclo.id, nivelId: nivel.id, carreraId: carrera.id, periodoAcademicoId: periodo.id, turno: 'MATUTINO' as const };
    const alumnos = [];
    for (let n = 0; n < 7; n++) alumnos.push(await post('/alumnos', { email: `ag${n}${ctx.sufijo}@example.invalid`, matricula: `AG${n}${ctx.sufijo}`, nombre: 'Alumno', apellidoPaterno: `Agrupación ${n}`, curp: 'GODE561231HDFRRN09', plantelId: ctx.plantelId }));
    const service = ctx.app.get(AgrupacionRegularService);
    const solicitar = (alumnoId: number, turno = d.turno) => ctx.dataSource.transaction('READ COMMITTED', m => service.solicitar(m, { ...d, alumnoId, turno }, user));
    for (let n = 0; n < 4; n++) expect((await solicitar(alumnos[n].id)).solicitud.estado).toBe('PENDIENTE');
    expect(await ctx.dataSource.getRepository(Grupo).countBy({ cicloId: ciclo.id })).toBe(0);
    await expect(ctx.dataSource.transaction('READ COMMITTED', async m => { await service.solicitar(m, { ...d, alumnoId: alumnos[4].id }, user); throw Error('Fallo de cargo posterior'); })).rejects.toThrow('Fallo de cargo');
    expect(await ctx.dataSource.getRepository(Grupo).countBy({ cicloId: ciclo.id })).toBe(0);
    expect(await ctx.dataSource.getRepository(SolicitudGrupoRegular).countBy({ cicloId: ciclo.id })).toBe(4);
    const quinta = await solicitar(alumnos[4].id); expect(quinta.asignadas).toHaveLength(5);
    const grupo = await ctx.dataSource.getRepository(Grupo).findOneByOrFail({ id: quinta.solicitud.grupoId! });
    expect(grupo).toMatchObject({ tipo: 'REGULAR', programaEspecialId: null, cupoManual: null });
    expect(await ctx.dataSource.getRepository(Inscripcion).countBy({ grupoId: grupo.id, estatus: 'ACTIVA' })).toBe(5);
    await expect(solicitar(alumnos[4].id)).rejects.toThrow('Ya existe');
    const paralelas = await Promise.all([alumnos[5], alumnos[6]].map(a => solicitar(a.id)));
    expect(paralelas.every(r => r.solicitud.grupoId === grupo.id)).toBe(true);
    expect(await ctx.dataSource.getRepository(Inscripcion).countBy({ grupoId: grupo.id, estatus: 'ACTIVA' })).toBe(7);
    await expect(ctx.dataSource.transaction('READ COMMITTED', m => service.solicitar(m, { ...d, alumnoId: alumnos[0].id }, { ...user, roles: ['FINANZAS'] }))).rejects.toThrow('Control Escolar');
  });
}
