import { crearInscripcionFixture } from './fixtures-inscripcion';
import { expect, it } from '@jest/globals';
import { Calificacion, Cargo, Grupo, GrupoMateria, Inscripcion, Usuario } from '../../src/entities';
import { ContextoIntegracion } from './contexto';
export function registrarProgramasEspeciales(ctx: ContextoIntegracion) {
  it('especiales manuales: cupo concurrente, doble modalidad, permisos, bajas e historial sin cargos', async () => {
    const token = async (id: number) => ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id })).email);
    const root = await token(ctx.superadminId), admin = await token(ctx.adminId), finanzas = await token(ctx.finanzasId);
    const ciclo = await ctx.api('/academico/ciclos', { method: 'POST', token: root, body: { clave: `EP${ctx.sufijo}`, nombre: 'Ciclo especial', fechaInicio: '2052-01-01', fechaFin: '2052-12-31' } }); expect(ciclo.response.status).toBe(201);
    const body = { plantelId: ctx.plantelId, cicloId: ciclo.data.id, clave: `ESP${ctx.sufijo}`, nombre: 'Diplomado manual', tipo: 'DIPLOMADO', fechaInicio: '2052-02-01', fechaFin: '2052-11-30' };
    expect((await ctx.api('/programas-especiales', { method: 'POST', token: finanzas, body })).response.status).toBe(403);
    expect((await ctx.api('/programas-especiales', { method: 'POST', token: admin, body: { ...body, plantelId: ctx.otroPlantelId } })).response.status).toBe(403);
    expect((await ctx.api('/programas-especiales', { method: 'POST', token: root, body: { ...body, fechaFin: '2051-01-01' } })).response.status).toBe(400);
    const programa = await ctx.api('/programas-especiales', { method: 'POST', token: admin, body }); expect(programa.response.status).toBe(201);
    const ruta = `/programas-especiales/${programa.data.id}`;
    const ajeno = await ctx.emitirFinanzasB(); expect((await ctx.api(ruta, { token: ajeno })).response.status).toBe(403);
    const docente = await ctx.api('/docentes', { method: 'POST', token: admin, body: { email: `espdoc${ctx.sufijo}@example.invalid`, numEmpleado: `ED${ctx.sufijo}`, nombre: 'Docente', apellidoPaterno: 'Especial', cedulaPendiente: true, plantelIds: [ctx.plantelId] } }); expect(docente.response.status).toBe(201);
    const materia = await ctx.api('/academico/materias', { method: 'POST', token: admin, body: { clave: `EM${ctx.sufijo}`, nombre: 'Asignatura especial', creditos: 0 } }); expect(materia.response.status).toBe(201);
    const grupoBody = { nombre: `EA${ctx.sufijo}`, cupoManual: 1, materiaId: materia.data.id, docenteId: docente.data.id };
    expect((await ctx.api(`${ruta}/grupos`, { method: 'POST', token: admin, body: { ...grupoBody, cupoManual: 0 } })).response.status).toBe(400);
    expect((await ctx.api(`${ruta}/grupos`, { method: 'POST', token: admin, body: { ...grupoBody, docenteId: ctx.docenteFueraDeAlcanceId } })).response.status).toBe(403);
    expect(await ctx.dataSource.getRepository(Grupo).countBy({ programaEspecialId: programa.data.id })).toBe(0); // Rollback de grupo + primera clase.
    const grupo = await ctx.api(`${ruta}/grupos`, { method: 'POST', token: admin, body: grupoBody }); expect(grupo.response.status).toBe(201);
    expect(grupo.data).toMatchObject({ tipo: 'ESPECIAL', cupoManual: 1 });
    const segundo = await ctx.api(`${ruta}/grupos`, { method: 'POST', token: admin, body: { ...grupoBody, nombre: `EB${ctx.sufijo}` } }); expect(segundo.response.status).toBe(201);
    const alumnos = [];
    for (let n = 0; n < 3; n++) {
      const a = await ctx.api('/alumnos', { method: 'POST', token: admin, body: { email: `espa${n}${ctx.sufijo}@example.invalid`, matricula: `ES${n}${ctx.sufijo}`, nombre: 'Alumno', apellidoPaterno: `Especial ${n}`, curp: 'GODE561231HDFRRN09', plantelId: ctx.plantelId } }); expect(a.response.status).toBe(201); alumnos.push(a.data);
    }
    const regular = await ctx.api('/academico/grupos', { method: 'POST', token: admin, body: { plantelId: ctx.plantelId, cicloId: ciclo.data.id, nombre: `ER${ctx.sufijo}` } }); expect(regular.response.status).toBe(201);
    const primaria = await crearInscripcionFixture(ctx,regular.data.id,alumnos[0].id);
    const inscribir = (gid: number, alumnoId: number) => ctx.api(`/programas-especiales/grupos/${gid}/inscripciones`, { method: 'POST', token: admin, body: { alumnoId } });
    const especial = await inscribir(grupo.data.id, alumnos[0].id); expect(especial.response.status).toBe(201);
    expect((await inscribir(grupo.data.id, alumnos[0].id)).response.status).toBe(409);
    const concurrentes = await Promise.all([alumnos[1], alumnos[2]].map((a) => inscribir(segundo.data.id, a.id)));
    expect(concurrentes.map((r) => r.response.status).sort()).toEqual([201, 409]);
    expect(await ctx.dataSource.getRepository(Inscripcion).countBy({ grupoId: segundo.data.id, estatus: 'ACTIVA' })).toBe(1);
    // La matrícula regular sigue siendo posible después de una especial del mismo ciclo.
    const ganador = concurrentes.find((r) => r.response.status === 201)!.data.alumnoId;
    await crearInscripcionFixture(ctx,regular.data.id,ganador);
    expect((await ctx.api(`/academico/grupos/${grupo.data.id}/alumnos`, { method: 'POST', token: admin, body: { alumnoId: alumnos[2].id } })).response.status).toBe(409);
    expect((await inscribir(regular.data.id, alumnos[2].id)).response.status).toBe(404);
    expect((await ctx.api(`/academico/grupos/${grupo.data.id}`, { method: 'PATCH', token: admin, body: { nombre: 'Mover a regular' } })).response.status).toBe(409);
    expect((await ctx.api(`/academico/inscripciones/${especial.data.id}`, { method: 'DELETE', token: admin })).response.status).toBe(409);
    const ordinarios = await ctx.api(`/academico/grupos?cicloId=${ciclo.data.id}`, { token: admin }); expect(ordinarios.data.datos.map((g: { id: number }) => g.id)).toEqual([regular.data.id]);
    const bajaRuta = `/programas-especiales/grupos/${grupo.data.id}/inscripciones/${especial.data.id}/baja`;
    expect((await ctx.api(bajaRuta, { method: 'POST', token: admin, body: { confirmado: false, motivo: 'Prueba' } })).response.status).toBe(400);
    expect((await ctx.api(bajaRuta, { method: 'POST', token: admin, body: { confirmado: true, motivo: 'Baja manual autorizada' } })).response.status).toBe(201);
    const reactivada = await inscribir(grupo.data.id, alumnos[0].id); expect(reactivada.response.status).toBe(201); expect(reactivada.data.id).toBe(especial.data.id);
    const alumToken = await ctx.emitirToken(`espa0${ctx.sufijo}@example.invalid`);
    const propios = await ctx.api('/programas-especiales/me', { token: alumToken }); expect(propios.response.status).toBe(200);
    expect(propios.data.datos.map((i: { inscripcionId: number }) => i.inscripcionId)).toContain(especial.data.id);
    expect((await ctx.api(ruta, { token: alumToken })).response.status).toBe(403);
    const otroAlumnoToken = await ctx.emitirToken(`espa2${ctx.sufijo}@example.invalid`);
    const noAjenos = await ctx.api('/programas-especiales/me', { token: otroAlumnoToken }); expect(noAjenos.data.datos.some((i: { inscripcionId: number }) => i.inscripcionId === especial.data.id)).toBe(false);
    const miembros = await ctx.api(`/programas-especiales/grupos/${grupo.data.id}/inscripciones`, { token: admin }); expect(miembros.data).toMatchObject({ pagina: 1, porPagina: 10, total: 1 });
    expect(JSON.stringify(miembros.data)).not.toMatch(/passwordHash|password_hash|curp|token/);
    const nota = await ctx.dataSource.getRepository(Calificacion).save({ alumnoId: alumnos[0].id, grupoMateriaId: grupo.data.clase.id, parcial: 1, calificacion: 88 });
    await ctx.api(`/programas-especiales/grupos/${grupo.data.id}`, { method: 'PATCH', token: admin, body: { cupoManual: 2 } });
    expect((await inscribir(grupo.data.id, alumnos[1].id)).response.status).toBe(201);
    expect((await ctx.api(`/programas-especiales/grupos/${grupo.data.id}`, { method: 'PATCH', token: admin, body: { cupoManual: 1 } })).response.status).toBe(409);
    expect((await ctx.api(`${ruta}/cerrar`, { method: 'POST', token: admin, body: { confirmado: true, motivo: 'Programa concluido' } })).response.status).toBe(201);
    expect((await inscribir(grupo.data.id, alumnos[2].id)).response.status).toBe(409);
    expect((await ctx.dataSource.getRepository(Inscripcion).findOneByOrFail({ id: primaria.id })).estatus).toBe('ACTIVA');
    expect((await ctx.dataSource.getRepository(Inscripcion).findOneByOrFail({ id: especial.data.id })).estatus).toBe('BAJA');
    expect((await ctx.dataSource.getRepository(Calificacion).findOneByOrFail({ id: nota.id })).calificacion).toBe(88);
    expect(await ctx.dataSource.getRepository(GrupoMateria).existsBy({ id: grupo.data.clase.id })).toBe(true);
    for (const a of alumnos) expect(await ctx.dataSource.getRepository(Cargo).countBy({ alumnoId: a.id })).toBe(0);
  });
}
