import { curpFicticia } from './identidad-ficticia';
import { expect, it } from '@jest/globals';
import { ContextoIntegracion } from './contexto';
import { Actividad, Alumno, Entrega, GrupoMateria, Inscripcion, Material, Usuario } from '../../src/entities';
export function registrarMaestroPaginado(ctx: ContextoIntegracion) {
  it('clase enfocada: 115 actividades, materiales/entregas/tareas paginados y detalle por alcance real', async () => {
    const token = async (id: number) => ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id })).email);
    const root = await token(ctx.superadminId), admin = await token(ctx.adminId), finanzas = await token(ctx.finanzasId);
    const base = await ctx.dataSource.getRepository(GrupoMateria).findOneByOrFail({ id: ctx.grupoMateriaIdMaestro }), maestro = await token(base.docente!.usuarioId);
    const grupo = await ctx.api('/academico/grupos', { method: 'POST', token: root, body: { nombre: 'UXCL-' + ctx.sufijo, plantelId: ctx.plantelId, cicloId: base.grupo.cicloId } }); expect(grupo.response.status).toBe(201);
    const clase = await ctx.dataSource.getRepository(GrupoMateria).save({ regimenEvaluacion: 'LEGADO_100', grupoId: grupo.data.id, materiaId: base.materiaId, docenteId: base.docenteId });
    const actividades = await ctx.dataSource.getRepository(Actividad).save(Array.from({ length: 115 }, (_, i) => ({ grupoMateriaId: clase.id, titulo: 'Actividad UX ' + i, tipo: 'TAREA' as const, parcial: 1, ponderacion: 0, fechaEntrega: null, activo: true })));
    await ctx.dataSource.getRepository(Material).save(Array.from({ length: 12 }, (_, i) => ({ grupoMateriaId: clase.id, titulo: 'Material UX ' + i, archivoNombre: 'fixture.txt', archivoRuta: '/uploads/fixture-ux-' + ctx.sufijo + '-' + i + '.txt', mime: 'text/plain', tamanoKb: 1 })));
    let alumnoPropio = 0, usuarioPropio = 0;
    for (let i = 0; i < 12; i++) {
      const r = await ctx.api('/alumnos', { method: 'POST', token: root, body: { email: 'uxcl' + i + ctx.sufijo + '@example.invalid', matricula: 'UXCL' + i + ctx.sufijo, nombre: 'Alumno UX', apellidoPaterno: 'Prueba', curp: curpFicticia(), plantelId: ctx.plantelId } }); expect(r.response.status).toBe(201);
      await ctx.dataSource.getRepository(Inscripcion).save({ grupoId: grupo.data.id, alumnoId: r.data.id, estatus: 'ACTIVA' });
      await ctx.dataSource.getRepository(Entrega).save({ actividadId: actividades[0].id, alumnoId: r.data.id, comentarioAlumno: 'Entrega de prueba', archivoNombre: null, archivoRuta: null, comentarioDocente: null, calificacion: null, estatus: 'ENTREGADA', fechaEntregado: new Date() });
      if (i === 0) { alumnoPropio = r.data.id; usuarioPropio = r.data.usuarioId; }
    }
    const alumno = await token(usuarioPropio);
    const ruta = '/grupo-materias/' + clase.id;
    const p1 = await ctx.api(ruta + '/actividades/listado', { token: maestro }), p12 = await ctx.api(ruta + '/actividades/listado?pagina=12', { token: maestro });
    expect(p1.data).toMatchObject({ total: 115, pagina: 1, porPagina: 10 }); expect(p1.data.datos).toHaveLength(10); expect(p12.data.datos).toHaveLength(5);
    const encontrada = await ctx.api(ruta + '/actividades/listado?buscar=Actividad%20UX%20114', { token: maestro }); expect(encontrada.data.total).toBe(1);
    expect((await ctx.api(ruta + '/materiales/listado?pagina=2', { token: alumno })).data.datos).toHaveLength(2);
    expect((await ctx.api('/actividades/' + actividades[0].id + '/entregas/listado?pagina=2', { token: maestro })).data.datos).toHaveLength(2);
    const primera = (await ctx.api('/actividades/' + actividades[0].id + '/entregas/listado', { token: maestro })).data.datos[0];
    expect(primera.alumno.usuario.passwordHash).toBeUndefined(); expect((await ctx.api('/entregas/' + primera.id, { token: alumno })).response.status).toBe(403);
    expect((await ctx.api('/entregas/' + primera.id, { token: maestro })).data.alumno.matricula).toBeTruthy();
    expect((await ctx.api(ruta + '/detalle', { token: maestro })).data).toMatchObject({ id: clase.id, materia: { id: base.materiaId } });
    expect((await ctx.api(ruta + '/detalle', { token: finanzas })).response.status).toBe(403);
    expect((await ctx.api(ruta + '/actividades/listado', { token: alumno })).response.status).toBe(403);
    expect((await ctx.api(ruta + '/materiales/listado?porPagina=101', { token: maestro })).response.status).toBe(400);
    expect((await ctx.api(ruta + '/actividades/listado?pagina=0', { token: maestro })).response.status).toBe(400);
    expect((await ctx.api('/alumnos/me/tareas/listado', { token: alumno })).data).toMatchObject({ total: 115, pagina: 1, porPagina: 10 });
    expect((await ctx.api('/alumnos/me/tareas/listado?pagina=12', { token: alumno })).data.datos).toHaveLength(5);
    const entregaPropia = (await ctx.api('/alumnos/me/tareas/listado', { token: alumno })).data.datos[0].entrega; expect(entregaPropia.alumnoId).toBe(alumnoPropio);
    expect((await ctx.api('/alumnos/me/tareas', { token: alumno })).data).toHaveLength(115);
    expect((await ctx.api(ruta + '/actividades', { token: maestro })).data).toHaveLength(115);
    expect((await ctx.api(ruta + '/materiales', { token: alumno })).data).toHaveLength(12);
    const ajeno = await ctx.api('/academico/grupos', { method: 'POST', token: root, body: { nombre: 'UXCL-B-' + ctx.sufijo, plantelId: ctx.otroPlantelId, cicloId: base.grupo.cicloId } });
    const otra = await ctx.dataSource.getRepository(GrupoMateria).save({ regimenEvaluacion: 'LEGADO_100', grupoId: ajeno.data.id, materiaId: base.materiaId, docenteId: ctx.docenteFueraDeAlcanceId });
    for (const t of [admin, maestro, alumno]) expect((await ctx.api('/grupo-materias/' + otra.id + '/materiales/listado', { token: t })).response.status).toBe(403);
    expect(await ctx.dataSource.getRepository(Alumno).countBy({ id: alumnoPropio })).toBe(1);
  });
}
