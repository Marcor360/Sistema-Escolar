import { ContextoIntegracion } from './contexto';
import { expect, it } from '@jest/globals';
import * as ExcelJS from 'exceljs';
import * as bcrypt from 'bcryptjs';
import { CicloEscolar, Grupo, Materia, Usuario } from '../../src/entities';
export const casos_calendario: Record<number, (ctx: ContextoIntegracion) => void> = {
  21: (ctx) => {
it('aísla eventos de dos grupos y planteles para alumnos, maestros y administrativo', async () => {
    const ciclo = await ctx.dataSource.getRepository(CicloEscolar).findOneByOrFail({ clave: `C${ctx.sufijo}` });
    const grupoA = await ctx.dataSource.getRepository(Grupo).findOneByOrFail({ nombre: `G${ctx.sufijo}`, plantelId: ctx.plantelId });
    const grupoB = await ctx.dataSource.getRepository(Grupo).findOneByOrFail({ nombre: `Y${ctx.sufijo}`, plantelId: ctx.plantelId });
    const tokenAdmin = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.adminId })).email);
    const tokenSuper = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.superadminId })).email);
    const tokenAlumnoA = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.alumnoUsuarioId })).email);
    const tokenAlumnoB = await ctx.emitirToken(`alumno_otro_grupo_${ctx.sufijo}@example.invalid`);
    const tokenMaestroA = await ctx.emitirToken(`maestro_scope_${ctx.sufijo}@example.invalid`);
    const altaB = await ctx.api('/docentes', { method: 'POST', token: tokenAdmin, body: {
      email: `maestro_b_${ctx.sufijo}@example.invalid`, password: 'Integracion_Segura_42!',
      nombre: 'Maestro', apellidoPaterno: 'B', cedulaPendiente: true, numEmpleado: `B${ctx.sufijo}`, plantelIds: [ctx.plantelId],
    } });
    expect(altaB.response.status).toBe(201);
    const materia = await ctx.dataSource.getRepository(Materia).findOneByOrFail({ clave: `MAT${ctx.sufijo}` });
    expect((await ctx.api(`/academico/grupos/${grupoB.id}/materias`, { method: 'POST', token: tokenAdmin,
      body: { materiaId: materia.id, docenteId: altaB.data.id } })).response.status).toBe(201);
    const tokenMaestroB = await ctx.emitirToken(`maestro_b_${ctx.sufijo}@example.invalid`);
    const grupoC = await ctx.dataSource.getRepository(Grupo).findOneByOrFail({ cicloId: ciclo.id, plantelId: ctx.otroPlantelId });
    const eventos = [
      { titulo: `GLOBAL-${ctx.sufijo}` }, { titulo: `PLANTEL-${ctx.sufijo}`, plantelId: ctx.plantelId },
      { titulo: `A-${ctx.sufijo}`, grupoId: grupoA.id, plantelId: ctx.plantelId },
      { titulo: `B-${ctx.sufijo}`, grupoId: grupoB.id, plantelId: ctx.plantelId },
      { titulo: `C-${ctx.sufijo}`, grupoId: grupoC.id, plantelId: ctx.otroPlantelId },
    ];
    for (const evento of eventos) expect((await ctx.api('/calendario', { method: 'POST', token: tokenSuper,
      body: { ...evento, fechaInicio: '2026-10-07T12:00:00Z' } })).response.status).toBe(201);
    for (const [token, propios, ajenos] of [
      [tokenAlumnoA, ['GLOBAL', 'PLANTEL', 'A'], ['B', 'C']],
      [tokenAlumnoB, ['GLOBAL', 'PLANTEL', 'B'], ['A', 'C']],
      [tokenMaestroA, ['GLOBAL', 'PLANTEL', 'A'], ['B', 'C']],
      [tokenMaestroB, ['GLOBAL', 'PLANTEL', 'B'], ['A', 'C']],
      [tokenAdmin, ['GLOBAL', 'PLANTEL', 'A', 'B'], ['C']],
    ] as const) {
      const respuesta = await ctx.api('/calendario?desde=2026-10-01&hasta=2026-10-31', { token }); expect(respuesta.response.status).toBe(200);
      const titulos = respuesta.data.map((e: { titulo: string }) => e.titulo);
      for (const titulo of propios) expect(titulos).toContain(`${titulo}-${ctx.sufijo}`);
      for (const titulo of ajenos) expect(titulos).not.toContain(`${titulo}-${ctx.sufijo}`);
    }
    expect((await ctx.api('/calendario', { method: 'POST', token: tokenSuper,
      body: { titulo: 'Fechas invertidas', fechaInicio: '2026-10-08T12:00:00Z', fechaFin: '2026-10-07T12:00:00Z' } })).response.status).toBe(400);
    expect((await ctx.api(`/reportes/boleta/${ctx.alumnoId}`, { token: tokenMaestroA })).response.status).toBe(403);
  });
  },
};

export function registrarMarcadoresCalendario(ctx: ContextoIntegracion) {
  it('calendario institucional: persiste marcadores, aísla planteles y resuelve concurrencia sin cambiar eventos', async () => {
    const ds = ctx.dataSource;
    const token = await ctx.emitirToken((await ds.getRepository(Usuario).findOneByOrFail({ id: ctx.adminId })).email);
    const root = await ctx.emitirToken((await ds.getRepository(Usuario).findOneByOrFail({ id: ctx.superadminId })).email);
    const post = (ruta: string, body: unknown, actor = token) => ctx.api(ruta, { method: 'POST', token: actor, body });
    const nivel = await post('/academico/catalogos/niveles', { plantelId: ctx.plantelId, clave: `MC${ctx.sufijo}`, nombre: 'Calendario institucional' });
    expect(nivel.response.status).toBe(201);
    const iniciales = await ctx.api('/calendario/marcadores', { token });
    expect(iniciales.response.status).toBe(200);
    expect(iniciales.data).toHaveLength(16);
    const base = { plantelId: ctx.plantelId, nombre: 'Semana cultural', color: '#154e7a', forma: 'INICIO' };
    expect((await post('/calendario/marcadores', { ...base, color: 'red; background:url(x)' })).response.status).toBe(400);
    expect((await post('/calendario/marcadores', { ...base, nombre: '   ' })).response.status).toBe(400);
    expect((await post('/calendario/marcadores', base, await ctx.emitirFinanzasB())).response.status).toBe(403);
    const alumno = await ctx.emitirToken((await ds.getRepository(Usuario).findOneByOrFail({ id: ctx.alumnoUsuarioId })).email);
    expect((await post('/calendario/marcadores', base, alumno)).response.status).toBe(403);
    const creado = await post('/calendario/marcadores', base);
    expect(creado.response.status).toBe(201);
    expect(creado.data).toMatchObject({ color: '#154E7A', revision: 1 });
    expect((await ctx.api(`/calendario/marcadores?plantelId=${ctx.otroPlantelId}`, { token })).response.status).toBe(403);
    const evento = await post('/calendario', { plantelId: ctx.plantelId, titulo: 'Actividad original', marcadorClave: creado.data.clave, fechaInicio: '2026-10-07T06:00:00Z', fechaFin: '2026-10-09T05:59:59Z' });
    expect(evento.response.status).toBe(201);
    const nuevo = { ...base, clave: creado.data.clave, revision: 1, nombre: 'Semana de ciencias', color: '#FFFF00' };
    const concurrentes = await Promise.all([post('/calendario/marcadores', nuevo), post('/calendario/marcadores', nuevo)]);
    expect(concurrentes.map(r => r.response.status).sort()).toEqual([201, 409]);
    const lista = await ctx.api('/calendario?desde=2026-10-01&hasta=2026-10-31', { token });
    const fecha = lista.data.find((e: { id: number }) => e.id === evento.data.id);
    expect(fecha).toMatchObject({ titulo: 'Actividad original', marcador: { nombre: 'Semana de ciencias', color: '#FFFF00' } });
    const ajeno = await post('/calendario/marcadores', { ...base, plantelId: ctx.otroPlantelId }, root);
    expect(ajeno.response.status).toBe(201);
    expect((await post('/calendario', { plantelId: ctx.plantelId, titulo: 'No debe cruzar planteles', marcadorClave: ajeno.data.clave, fechaInicio: '2026-10-10T06:00:00Z' })).response.status).toBe(400);
    expect((await post('/calendario/marcadores', { ...base, clave: 'apertura', revision: 0, forma: 'FONDO' })).response.status).toBe(201);
    const restaurados = await ctx.api(`/calendario/marcadores?plantelId=${ctx.plantelId}`, { token });
    expect(restaurados.data).toHaveLength(17);
    expect(restaurados.data.find((m: { clave: string }) => m.clave === 'apertura')).toMatchObject({ nombre: 'Semana cultural', revision: 1 });
    expect((await ctx.api('/calendario/' + fecha.id, { method: 'PATCH', token, body: { marcadorClave: '', revision: fecha.revision } })).response.status).toBe(200);
    const final = await ctx.api('/calendario/' + fecha.id, { token });
    expect(final.data).toMatchObject({ titulo: 'Actividad original', marcadorClave: null });
  });
}
