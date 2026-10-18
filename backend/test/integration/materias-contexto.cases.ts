import { expect, it } from '@jest/globals';
import { ContextoIntegracion } from './contexto';
import { Materia, Usuario, GrupoMateria } from '../../src/entities';
export function registrarMateriasContexto(ctx: ContextoIntegracion) {
  it('materias: tipo explícito, varios planes sin duplicación, alcance, histórico y contexto docente completo', async () => {
    const token = async (id: number) => ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id })).email);
    const root = await token(ctx.superadminId), admin = await token(ctx.adminId), finanzas = await token(ctx.finanzasId), alumno = await token(ctx.alumnoUsuarioId);
    const post = async (ruta: string, body: unknown, t = root) => { const r = await ctx.api(ruta, { method: 'POST', token: t, body }); expect(r.response.status).toBe(201); return r.data; };
    const materia = await post('/academico/materias', { clave: `MC${ctx.sufijo}`, nombre: 'Materia compartida', creditos: 0, descripcion: 'Descripción histórica' });
    expect(materia.tipo).toBeNull();
    const ruta = `/academico/materias/${materia.id}`;
    expect((await ctx.api(ruta, { method: 'PATCH', token: admin, body: { tipo: 'OTRO' } })).response.status).toBe(400);
    expect((await ctx.api(ruta, { method: 'PATCH', token: admin, body: { tipo: 'OPTATIVA', creditos: 4 } })).response.status).toBe(200);
    expect(await ctx.dataSource.getRepository(Materia).findOneByOrFail({ id: materia.id })).toMatchObject({ tipo: 'OPTATIVA', creditos: 4, descripcion: 'Descripción histórica' });
    const ciclo = await post('/academico/ciclos', { clave: `CM${ctx.sufijo}`, nombre: 'Ciclo de contexto', fechaInicio: '2053-01-01', fechaFin: '2053-12-31' });
    const periodos: number[] = [];
    let nivelId = 0, carreraId = 0;
    for (const plantelId of [ctx.plantelId, ctx.otroPlantelId]) {
      const nivel = await post('/academico/catalogos/niveles', { plantelId, clave: `NM${ctx.sufijo}`, nombre: 'Nivel de materia' });
      const carrera = await post('/academico/catalogos/carreras', { plantelId, nivelId: nivel.id, clave: `PM${ctx.sufijo}`, nombre: 'Carrera de materia', versionPlan: 'Plan explícito' });
      const periodo = await post('/academico/catalogos/periodos', { plantelId, carreraId: carrera.id, cicloId: ciclo.id, clave: 'S1', nombre: 'Primer semestre', tipo: 'SEMESTRAL', numero: 1 });
      periodos.push(periodo.id); if (plantelId === ctx.plantelId) { nivelId = nivel.id; carreraId = carrera.id; }
    }
    const vincular = (periodoAcademicoId: number, t = admin) => ctx.api(ruta + '/contextos', { method: 'POST', token: t, body: { periodoAcademicoId } });
    expect((await vincular(periodos[0], finanzas)).response.status).toBe(403);
    expect((await vincular(periodos[1])).response.status).toBe(403);
    const simultaneas = await Promise.all([vincular(periodos[0]), vincular(periodos[0])]);
    expect(simultaneas.map(r => r.response.status).sort()).toEqual([201, 409]);
    const a = simultaneas.find(r => r.response.status === 201)!.data;
    const b = await post(ruta + '/contextos', { periodoAcademicoId: periodos[1] });
    expect((await ctx.api(ruta + '/contextos', { token: admin })).data.total).toBe(1);
    expect((await ctx.api(ruta + '/contextos', { token: root })).data.total).toBe(2);
    expect((await ctx.api(ruta + '/contextos', { token: alumno })).response.status).toBe(403);
    expect((await ctx.api(ruta + '/contextos/' + b.id, { method: 'DELETE', token: admin })).response.status).toBe(403);
    const docente = await post('/docentes', { email: `mc_${ctx.sufijo}@example.invalid`, nombre: 'Docente contexto', apellidoPaterno: 'Prueba', numEmpleado: `MC${ctx.sufijo}`, cedulaPendiente: true, plantelIds: [ctx.plantelId] });
    const grupo = await post('/academico/grupos', { nombre: `MC${ctx.sufijo}`, plantelId: ctx.plantelId, cicloId: ciclo.id, nivelId, carreraId, periodoAcademicoId: periodos[0], turno: 'VESPERTINO' });
    const clase = await post(`/academico/grupos/${grupo.id}/materias`, { materiaId: materia.id, docenteId: docente.id });
    const detalle = await ctx.api('/docentes/' + docente.id, { token: admin });
    expect(detalle.data.clases.find((c: { id: number }) => c.id === clase.id)).toMatchObject({ nivel: 'Nivel de materia', carrera: 'Carrera de materia', versionPlan: 'Plan explícito', periodo: 'Primer semestre', turno: 'VESPERTINO', materia: 'Materia compartida' });
    expect((await ctx.api(ruta, { method: 'DELETE', token: admin })).response.status).toBe(403);
    expect((await ctx.api(ruta, { method: 'DELETE', token: root })).response.status).toBe(409);
    expect((await ctx.api(ruta + '/contextos/' + a.id, { method: 'DELETE', token: admin })).response.status).toBe(200);
    expect(await ctx.dataSource.getRepository(GrupoMateria).countBy({ id: clase.id, materiaId: materia.id })).toBe(1);
    expect((await vincular(periodos[0])).response.status).toBe(201);
  });
}
