import { expect, it } from '@jest/globals';
import { Grupo, GrupoMateria, Usuario } from '../../src/entities';
import { ContextoIntegracion } from './contexto';
export function registrarCatalogos(ctx: ContextoIntegracion) {
  it('catálogos: permisos, planes/periodos compatibles, paginación y preservación histórica', async () => {
    const token = async (id: number) => ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id })).email);
    const root = await token(ctx.superadminId), admin = await token(ctx.adminId), finanzas = await token(ctx.finanzasId), alumno = await token(ctx.alumnoUsuarioId);
    const ruta = '/academico/catalogos';
    expect((await ctx.api(`${ruta}/niveles`)).response.status).toBe(401);
    expect((await ctx.api(`${ruta}/niveles`, { token: alumno })).response.status).toBe(403);
    const body = { plantelId: ctx.plantelId, clave: `N${ctx.sufijo}`, nombre: 'Nivel configurable' };
    expect((await ctx.api(`${ruta}/niveles`, { method: 'POST', token: finanzas, body })).response.status).toBe(403);
    expect((await ctx.api(`${ruta}/niveles`, { method: 'POST', token: admin, body: { ...body, plantelId: ctx.otroPlantelId } })).response.status).toBe(403);
    const repetidos = await Promise.all([1, 2].map(() => ctx.api(`${ruta}/niveles`, { method: 'POST', token: admin, body })));
    expect(repetidos.map((r) => r.response.status).sort()).toEqual([201, 409]);
    const nivel = repetidos.find((r) => r.response.status === 201)!.data;
    const ajeno = await ctx.api(`${ruta}/niveles`, { method: 'POST', token: root, body: { ...body, plantelId: ctx.otroPlantelId } });
    expect(ajeno.response.status).toBe(201);
    expect((await ctx.api(`${ruta}/niveles/${ajeno.data.id}`, { token: admin })).response.status).toBe(403);
    const carreraBody = { ...body, clave: `C${ctx.sufijo}`, nivelId: nivel.id, versionPlan: 'Plan configurable' };
    expect((await ctx.api(`${ruta}/carreras`, { method: 'POST', token: root, body: { ...carreraBody, plantelId: ctx.otroPlantelId } })).response.status).toBe(409);
    const carrera = await ctx.api(`${ruta}/carreras`, { method: 'POST', token: admin, body: carreraBody }); expect(carrera.response.status).toBe(201);
    const ciclo = await ctx.api('/academico/ciclos', { method: 'POST', token: root, body: { clave: `CC${ctx.sufijo}`, nombre: 'Ciclo de catálogos', fechaInicio: '2050-01-01', fechaFin: '2050-12-31' } }); expect(ciclo.response.status).toBe(201);
    const periodo = await ctx.api(`${ruta}/periodos`, { method: 'POST', token: admin, body: { ...body, clave: 'S1', carreraId: carrera.data.id, cicloId: ciclo.data.id, tipo: 'SEMESTRAL', numero: 1 } }); expect(periodo.response.status).toBe(201);
    const base = { plantelId: ctx.plantelId, cicloId: ciclo.data.id, nombre: `CG${ctx.sufijo}`, nivelId: nivel.id, carreraId: carrera.data.id, periodoAcademicoId: periodo.data.id };
    expect((await ctx.api('/academico/grupos', { method: 'POST', token: root, body: { ...base, nivelId: ajeno.data.id } })).response.status).toBe(409);
    const grupo = await ctx.api('/academico/grupos', { method: 'POST', token: admin, body: base }); expect(grupo.response.status).toBe(201);
    const filtrado = await ctx.api(`/academico/grupos?cicloId=${ciclo.data.id}&nivelId=${nivel.id}&carreraId=${carrera.data.id}&periodoAcademicoId=${periodo.data.id}`, { token: admin });
    expect(filtrado.data.datos.map((g: { id: number }) => g.id)).toEqual([grupo.data.id]);
    const otro = await ctx.api(`/academico/grupos?cicloId=${ciclo.data.id}&nivelId=${ajeno.data.id}`, { token: root }); expect(otro.data.total).toBe(0);
    expect((await ctx.api(`${ruta}/niveles/${nivel.id}`, { method: 'PATCH', token: admin, body: { activo: false } })).response.status).toBe(409);
    const pagina = await ctx.api(`${ruta}/niveles?buscar=${body.clave}`, { token: admin }); expect(pagina.data).toMatchObject({ total: 1, pagina: 1, porPagina: 10 });
    const clase = await ctx.dataSource.getRepository(GrupoMateria).findOneByOrFail({ id: ctx.grupoMateriaIdMaestro });
    const historico = await ctx.dataSource.getRepository(Grupo).findOneByOrFail({ id: clase.grupoId });
    expect(historico.nivelId).toBeNull();
  });
}
