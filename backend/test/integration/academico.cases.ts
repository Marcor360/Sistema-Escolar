import { ContextoIntegracion } from './contexto';
import { expect, it, jest } from '@jest/globals';
import * as ExcelJS from 'exceljs';
import * as bcrypt from 'bcryptjs';
import { Alumno, CicloEscolar, Grupo, Inscripcion, Usuario } from '../../src/entities';
export const casos_academico: Record<number, (ctx: ContextoIntegracion) => void> = {
  9: (ctx) => {
it('prepara sin cambiar el vigente y activa un único ciclo mediante transición explícita', async () => {
    const token = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.superadminId })).email);
    const previos = await ctx.dataSource.getRepository(CicloEscolar).findBy({ activo: true });
    const crear = (clave: string) => ctx.api('/academico/ciclos', { method: 'POST', token, body: { clave, nombre: 'Ciclo preparado', fechaInicio: '2026-08-01', fechaFin: '2027-07-31' } });
    const primero = await crear(`A${ctx.sufijo}`); const segundo = await crear(`B${ctx.sufijo}`);
    expect(primero.response.status).toBe(201); expect(segundo.response.status).toBe(201);
    expect(primero.data).toMatchObject({ activo: false, estado: 'PREPARACION' });
    expect((await ctx.dataSource.getRepository(CicloEscolar).findBy({ activo: true })).map((c) => c.id)).toEqual(previos.map((c) => c.id));
    expect((await ctx.api(`/academico/ciclos/${primero.data.id}`, { method: 'PATCH', token, body: { activo: true } })).response.status).toBe(400);
    for (const c of previos) {
      expect((await ctx.api(`/academico/ciclos/${c.id}/iniciar-cierre`, { method: 'POST', token, body: { confirmado: true } })).response.status).toBe(201);
      expect((await ctx.api(`/academico/ciclos/${c.id}/cerrar`, { method: 'POST', token, body: { confirmado: true } })).response.status).toBe(201);
    }
    const respuestas = await Promise.all([primero, segundo].map((c) => ctx.api(`/academico/ciclos/${c.data.id}/activar`, { method: 'POST', token, body: { confirmado: true } })));
    expect(respuestas.filter((c) => c.response.status === 201)).toHaveLength(1);
    expect(respuestas.filter((c) => c.response.status === 409)).toHaveLength(1);
    expect(await ctx.dataSource.getRepository(CicloEscolar).countBy({ activo: true })).toBe(1);
    const vigente = await ctx.dataSource.getRepository(CicloEscolar).findOneByOrFail({ activo: true });
    expect((await ctx.api(`/academico/ciclos/${vigente.id}/iniciar-cierre`, { method: 'POST', token, body: { confirmado: true } })).response.status).toBe(201);
    expect((await ctx.api(`/academico/ciclos/${vigente.id}/cerrar`, { method: 'POST', token, body: { confirmado: true } })).response.status).toBe(201);
  });
  },
  11: (ctx) => {
it('impide inscribir en grupos inactivos y a alumnos dados de baja', async () => {
    const admin = await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.adminId });
    const token = await ctx.emitirToken(admin.email);
    const ciclo = await ctx.dataSource.getRepository(CicloEscolar).findOneByOrFail({ clave: `C${ctx.sufijo}` });
    const inactivo = await ctx.api('/academico/grupos', {
      method: 'POST', token,
      body: { cicloId: ciclo.id, plantelId: ctx.plantelId, nombre: `INACTIVO${ctx.sufijo}` },
    });
    expect(inactivo.response.status).toBe(201);
    expect((await ctx.api(`/academico/grupos/${inactivo.data.id}`, { method: 'DELETE', token })).response.status).toBe(200);
    const inscripcionInactiva = await ctx.api(`/academico/grupos/${inactivo.data.id}/alumnos`, {
      method: 'POST', token, body: { alumnoId: ctx.alumnoId },
    });
    expect(inscripcionInactiva.response.status).toBe(409);
    expect(await ctx.dataSource.getRepository(Inscripcion).countBy({ grupoId: inactivo.data.id })).toBe(0);

    const alumnoBaja = await ctx.api('/alumnos', {
      method: 'POST', token,
      body: {
        email: `alumno_baja_${ctx.sufijo}@example.invalid`, password: 'Integracion_Segura_42!',
        nombre: 'Alumno', apellidoPaterno: 'Baja', matricula: `AB${ctx.sufijo}`, plantelId: ctx.plantelId,
      },
    });
    expect(alumnoBaja.response.status).toBe(201);
    await ctx.dataSource.getRepository(Alumno).update(alumnoBaja.data.id, { estatus: 'BAJA' });
    const grupoActivo = await ctx.dataSource.getRepository(Grupo).findOneByOrFail({ nombre: `G${ctx.sufijo}`, plantelId: ctx.plantelId });
    const inscripcionBaja = await ctx.api(`/academico/grupos/${grupoActivo.id}/alumnos`, {
      method: 'POST', token, body: { alumnoId: alumnoBaja.data.id },
    });
    expect(inscripcionBaja.response.status).toBe(409);
    expect(await ctx.dataSource.getRepository(Inscripcion).countBy({ grupoId: grupoActivo.id, alumnoId: alumnoBaja.data.id })).toBe(0);
  });
  },
  13: (ctx) => {
it('MAESTRO solo lista y consulta alumnos de sus grupos, aunque compartan plantel', async () => {
    const admin = await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.adminId });
    const tokenAdmin = await ctx.emitirToken(admin.email);
    const altaDocente = await ctx.api('/docentes', {
      method: 'POST', token: tokenAdmin,
      body: {
        email: `maestro_scope_${ctx.sufijo}@example.invalid`, password: 'Integracion_Segura_42!',
        nombre: 'Maestro', apellidoPaterno: 'Scope', numEmpleado: `S${ctx.sufijo}`, plantelIds: [ctx.plantelId],
      },
    });
    expect(altaDocente.response.status).toBe(201);
    const asignacion = await ctx.api(`/academico/grupo-materias/${ctx.grupoMateriaIdMaestro}/docente/${altaDocente.data.id}`, {
      method: 'PATCH', token: tokenAdmin,
    });
    expect(asignacion.response.status).toBe(200);
    const segundoAlumno = await ctx.api('/alumnos', {
      method: 'POST', token: tokenAdmin,
      body: {
        email: `alumno_otro_grupo_${ctx.sufijo}@example.invalid`, password: 'Integracion_Segura_42!',
        nombre: 'Alumno', apellidoPaterno: 'Otro grupo', matricula: `O${ctx.sufijo}`, plantelId: ctx.plantelId,
      },
    });
    expect(segundoAlumno.response.status).toBe(201);
    const ciclo = await ctx.dataSource.getRepository(CicloEscolar).findOneByOrFail({ clave: `C${ctx.sufijo}` });
    const grupoOtro = await ctx.api('/academico/grupos', {
      method: 'POST', token: tokenAdmin,
      body: { cicloId: ciclo.id, plantelId: ctx.plantelId, nombre: `Y${ctx.sufijo}`, grado: '2' },
    });
    expect(grupoOtro.response.status).toBe(201);
    const inscripcion = await ctx.api(`/academico/grupos/${grupoOtro.data.id}/alumnos`, {
      method: 'POST', token: tokenAdmin, body: { alumnoId: segundoAlumno.data.id },
    });
    expect(inscripcion.response.status).toBe(201);

    const tokenMaestro = await ctx.emitirToken(`maestro_scope_${ctx.sufijo}@example.invalid`);
    const [listado, propio, ajeno] = await Promise.all([
      ctx.api('/alumnos', { token: tokenMaestro }),
      ctx.api(`/alumnos/${ctx.alumnoId}`, { token: tokenMaestro }),
      ctx.api(`/alumnos/${segundoAlumno.data.id}`, { token: tokenMaestro }),
    ]);
    expect(listado.response.status).toBe(200);
    expect(listado.data.datos.map((a: Alumno) => a.id)).toContain(ctx.alumnoId);
    expect(listado.data.datos.map((a: Alumno) => a.id)).not.toContain(segundoAlumno.data.id);
    expect(propio.response.status).toBe(200);
    expect(ajeno.response.status).toBe(403);
  });
  },
  23: (ctx) => {
it('impide doble inscripción concurrente y cambios de ciclo; rechaza grupos en ciclos cerrados', async () => {
    const token = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.adminId })).email);
    const grupoA = await ctx.dataSource.getRepository(Grupo).findOneByOrFail({ nombre: `G${ctx.sufijo}`, plantelId: ctx.plantelId });
    const grupoB = await ctx.dataSource.getRepository(Grupo).findOneByOrFail({ nombre: `Y${ctx.sufijo}`, plantelId: ctx.plantelId });
    const alta = await ctx.api('/alumnos', { method: 'POST', token, body: { nombre: 'Concurrente', apellidoPaterno: 'Prueba',
      matricula: `CON${ctx.sufijo}`, email: `con_${ctx.sufijo}@example.invalid`, password: 'Integracion_Segura_42!', plantelId: ctx.plantelId } });
    expect(alta.response.status).toBe(201);
    const respuestas = await Promise.all([grupoA, grupoB].map((g) => ctx.api(`/academico/grupos/${g.id}/alumnos`, {
      method: 'POST', token, body: { alumnoId: alta.data.id },
    })));
    expect(respuestas.map((r) => r.response.status).sort()).toEqual([201, 409]);
    expect(await ctx.dataSource.getRepository(Inscripcion).countBy({ alumnoId: alta.data.id, estatus: 'ACTIVA' })).toBe(1);
    const cerrado = await ctx.dataSource.getRepository(CicloEscolar).findOneOrFail({ where: { estado: 'CERRADO' } });
    expect((await ctx.api('/academico/grupos', { method: 'POST', token, body: { cicloId: cerrado.id, plantelId: ctx.plantelId, nombre: 'Cerrado' } })).response.status).toBe(409);
    expect((await ctx.api(`/academico/grupos/${grupoA.id}`, { method: 'PATCH', token, body: { cicloId: cerrado.id } })).response.status).toBe(409);
  });
  },
  46: (ctx) => {
it('promoción bloquea grupos y revalida una desactivación concurrente antes de inscribir', async () => {
    const origenCiclo = await ctx.dataSource.getRepository(CicloEscolar).save({ clave: `PCO${ctx.sufijo}`, nombre: 'Origen carrera', fechaInicio: '2034-01-01', fechaFin: '2034-12-31', activo: false, estado: 'CERRADO' });
    const destinoCiclo = await ctx.dataSource.getRepository(CicloEscolar).save({ clave: `PCD${ctx.sufijo}`, nombre: 'Destino carrera', fechaInicio: '2035-01-01', fechaFin: '2035-12-31', activo: false, estado: 'PREPARACION' });
    const origen = await ctx.dataSource.getRepository(Grupo).save({ cicloId: origenCiclo.id, plantelId: ctx.plantelId, nombre: `PCO-${ctx.sufijo}`, activo: false });
    const destino = await ctx.dataSource.getRepository(Grupo).save({ cicloId: destinoCiclo.id, plantelId: ctx.plantelId, nombre: `PCD-${ctx.sufijo}`, activo: true });
    await ctx.dataSource.getRepository(Inscripcion).save({ grupoId: origen.id, alumnoId: ctx.alumnoId, estatus: 'ACTIVA' });
    const token = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.adminId })).email);
    const holder = ctx.dataSource.createQueryRunner(); await holder.connect(); await holder.startTransaction();
    await holder.manager.getRepository(Grupo).createQueryBuilder('g').select('g.id').where('g.id = :id', { id: destino.id }).setLock('pessimistic_write').getOne();
    let senal!: () => void; const bloqueoSolicitado = new Promise<void>((r) => { senal = r; });
    const original = ctx.dataSource.createQueryRunner.bind(ctx.dataSource);
    const espia = jest.spyOn(ctx.dataSource, 'createQueryRunner').mockImplementation((modo) => {
      const runner = original(modo), query = runner.query.bind(runner);
      runner.query = ((sql: string, ...args: any[]) => { if (/grupos/i.test(sql) && /FOR UPDATE|UPDLOCK/i.test(sql)) senal(); return query(sql, ...args); }) as typeof runner.query;
      return runner;
    });
    try {
      const pendiente = ctx.api('/academico/promocion/confirmar', { method: 'POST', token, body: { origenGrupoId: origen.id, destinoGrupoId: destino.id, alumnoIds: [ctx.alumnoId], confirmado: true } });
      await bloqueoSolicitado;
      await holder.manager.getRepository(Grupo).update(destino.id, { activo: false }); await holder.commitTransaction();
      expect((await pendiente).response.status).toBe(409);
      expect(await ctx.dataSource.getRepository(Inscripcion).countBy({ grupoId: destino.id, estatus: 'ACTIVA' })).toBe(0);
    } finally { espia.mockRestore(); if (holder.isTransactionActive) await holder.rollbackTransaction(); await holder.release(); }
  });
  },
};
