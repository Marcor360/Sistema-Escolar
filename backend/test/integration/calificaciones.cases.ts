import { ContextoIntegracion } from './contexto';
import { expect, it } from '@jest/globals';
import * as ExcelJS from 'exceljs';
import * as bcrypt from 'bcryptjs';
import { Alumno, Calificacion, CicloEscolar, Grupo, GrupoMateria, Inscripcion, BitacoraAcademica, Entrega, Materia, Usuario } from '../../src/entities';
export const casos_calificaciones: Record<number, (ctx: ContextoIntegracion) => void> = {
  10: (ctx) => {
it('inscribe a un alumno, captura una calificaci??n y la muestra en su portal', async () => {
    const admin = await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.adminId });
    const alumnoUsuario = await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.alumnoUsuarioId });
    const tokenAdmin = await ctx.emitirToken(admin.email);
    const tokenAlumno = await ctx.emitirToken(alumnoUsuario.email);
    expect((await ctx.api('/academico/materias', { token: tokenAlumno })).response.status).toBe(403);
    expect((await ctx.api('/academico/ciclos', { token: tokenAlumno })).response.status).toBe(403);

    const ciclo = await ctx.api('/academico/ciclos', {
      method: 'POST', token: tokenAdmin,
      body: { clave: `C${ctx.sufijo}`, nombre: 'Ciclo de integración', fechaInicio: '2026-08-01', fechaFin: '2027-07-31' },
    });
    expect(ciclo.response.status).toBe(201);
    const tokenActivacion = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.superadminId })).email);
    expect((await ctx.api(`/academico/ciclos/${ciclo.data.id}/activar`, { method: 'POST', token: tokenActivacion, body: { confirmado: true } })).response.status).toBe(201);
    const materia = await ctx.api('/academico/materias', {
      method: 'POST', token: tokenAdmin,
      body: { clave: `MAT${ctx.sufijo}`, nombre: 'Materia de integración' },
    });
    expect(materia.response.status).toBe(201);
    const grupo = await ctx.api('/academico/grupos', {
      method: 'POST', token: tokenAdmin,
      body: { cicloId: ciclo.data.id, plantelId: ctx.plantelId, nombre: `G${ctx.sufijo}`, grado: '1' },
    });
    expect(grupo.response.status).toBe(201);
    const tokenSuperadmin = await ctx.emitirToken(
      (await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.superadminId })).email,
    );
    const grupoMismoNombreOtroPlantel = await ctx.api('/academico/grupos', {
      method: 'POST', token: tokenSuperadmin,
      body: { cicloId: ciclo.data.id, plantelId: ctx.otroPlantelId, nombre: `G${ctx.sufijo}`, grado: '1' },
    });
    expect(grupoMismoNombreOtroPlantel.response.status).toBe(201);
    const grupoDuplicadoMismoPlantel = await ctx.api('/academico/grupos', {
      method: 'POST', token: tokenSuperadmin,
      body: { cicloId: ciclo.data.id, plantelId: ctx.plantelId, nombre: `G${ctx.sufijo}`, grado: '2' },
    });
    expect(grupoDuplicadoMismoPlantel.response.status).toBe(409);
    const grupoId = grupo.data.id;
    const asignacion = await ctx.api(`/academico/grupos/${grupoId}/materias`, {
      method: 'POST', token: tokenAdmin, body: { materiaId: materia.data.id },
    });
    expect(asignacion.response.status).toBe(201);
    const grupoMateriaId = asignacion.data.id;
    ctx.grupoMateriaIdMaestro = grupoMateriaId;

    const inscripcion = await ctx.api(`/academico/grupos/${grupoId}/alumnos`, {
      method: 'POST', token: tokenAdmin, body: { alumnoId: ctx.alumnoId },
    });
    expect(inscripcion.response.status).toBe(201);
    const captura = await ctx.api('/calificaciones/captura', {
      method: 'POST', token: tokenAdmin,
      body: { grupoMateriaId, parcial: 1, items: [{ alumnoId: ctx.alumnoId, calificacion: 92 }] },
    });
    expect(captura.response.status).toBe(201);
    expect(captura.data.capturadas).toBe(1);

    const calificaciones = await ctx.api('/calificaciones/mias', { token: tokenAlumno });
    expect(calificaciones.response.status).toBe(200);
    expect(calificaciones.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ grupoMateriaId, parcial: 1, calificacion: 92 }),
    ]));
    expect(await ctx.dataSource.getRepository(Inscripcion).countBy({ alumnoId: ctx.alumnoId, grupoId, estatus: 'ACTIVA' })).toBe(1);
  });
  },
  12: (ctx) => {
it('conserva notas de entregas calificadas y bloquea envíos a actividades desactivadas', async () => {
    const admin = await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.adminId });
    const alumnoUsuario = await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.alumnoUsuarioId });
    const tokenAdmin = await ctx.emitirToken(admin.email);
    const tokenAlumno = await ctx.emitirToken(alumnoUsuario.email);
    const actividad = await ctx.api('/actividades', {
      method: 'POST', token: tokenAdmin,
      body: { grupoMateriaId: ctx.grupoMateriaIdMaestro, titulo: `Reentrega ${ctx.sufijo}` },
    });
    expect(actividad.response.status).toBe(201);

    const primera = await ctx.api(`/actividades/${actividad.data.id}/entrega`, {
      method: 'POST', token: tokenAlumno, body: { comentario: 'Primera versión' },
    });
    expect(primera.response.status).toBe(201);
    const calificada = await ctx.api(`/entregas/${primera.data.id}/calificar`, {
      method: 'PATCH', token: tokenAdmin, body: { calificacion: 80, comentario: 'Corregir' },
    });
    expect(calificada.response.status).toBe(200);
    const corregida = await ctx.api(`/actividades/${actividad.data.id}/entrega`, {
      method: 'POST', token: tokenAlumno, body: { comentario: 'Segunda versión' },
    });
    expect(corregida.response.status).toBe(409);
    const entregaConservada = await ctx.dataSource.getRepository(Entrega).findOneByOrFail({ id: primera.data.id });
    expect(entregaConservada.calificacion).toBe(80);
    expect(entregaConservada.estatus).toBe('CALIFICADA');

    expect((await ctx.api(`/actividades/${actividad.data.id}`, { method: 'DELETE', token: tokenAdmin })).response.status).toBe(200);
    const inactiva = await ctx.api(`/actividades/${actividad.data.id}/entrega`, {
      method: 'POST', token: tokenAlumno, body: { comentario: 'Tercera versión' },
    });
    expect(inactiva.response.status).toBe(409);
  });
  },
  24: (ctx) => {
it('exige motivo, muestra faltantes y bloquea cierre/modificación del periodo', async () => {
    const token = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.adminId })).email);
    const contexto = await ctx.dataSource.getRepository(GrupoMateria).findOneByOrFail({ id: ctx.grupoMateriaIdMaestro });
    const faltante = await ctx.api('/alumnos', { method: 'POST', token, body: { nombre: 'Sin nota', apellidoPaterno: 'Periodo',
      matricula: `FAL${ctx.sufijo}`, email: `faltante_${ctx.sufijo}@example.invalid`, password: 'Integracion_Segura_42!', plantelId: ctx.plantelId } });
    expect(faltante.response.status).toBe(201);
    expect((await ctx.api(`/academico/grupos/${contexto.grupoId}/alumnos`, { method: 'POST', token, body: { alumnoId: faltante.data.id } })).response.status).toBe(201);
    const ruta = `/calificaciones/periodos/${ctx.grupoMateriaIdMaestro}/1`;
    expect((await ctx.api('/calificaciones/captura', { method: 'POST', token,
      body: { grupoMateriaId: ctx.grupoMateriaIdMaestro, parcial: 1, items: [{ alumnoId: ctx.alumnoId, calificacion: 91 }] } })).response.status).toBe(400);
    const estado = await ctx.api(ruta, { token }); expect(estado.response.status).toBe(200); expect(estado.data.faltantes).toBeGreaterThan(0);
    expect((await ctx.api(ruta, { method: 'PATCH', token, body: { estatus: 'CERRADO' } })).response.status).toBe(409);
    const gm = await ctx.dataSource.getRepository(GrupoMateria).findOneByOrFail({ id: ctx.grupoMateriaIdMaestro });
    const inscritos = await ctx.dataSource.getRepository(Inscripcion).findBy({ grupoId: gm.grupoId, estatus: 'ACTIVA' });
    expect((await ctx.api('/calificaciones/captura', { method: 'POST', token, body: {
      grupoMateriaId: gm.id, parcial: 1, motivo: 'Corrección verificada', items: inscritos.map((i) => ({ alumnoId: i.alumnoId, calificacion: 91 })),
    } })).response.status).toBe(201);
    expect((await ctx.api(ruta, { method: 'PATCH', token, body: { estatus: 'CERRADO' } })).response.status).toBe(200);
    expect((await ctx.api('/calificaciones/captura', { method: 'POST', token,
      body: { grupoMateriaId: gm.id, parcial: 1, motivo: 'Intento cerrado', items: [{ alumnoId: ctx.alumnoId, calificacion: 90 }] } })).response.status).toBe(409);
    expect((await ctx.api(ruta, { method: 'PATCH', token, body: { estatus: 'ABIERTO' } })).response.status).toBe(200);
  });
  },
  29: (ctx) => {
it('separa notas de ciclos, calcula P1-P3 sin Final y exporta inscritos sin nota', async () => {
    const token = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.adminId })).email);
    const movil = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.alumnoUsuarioId })).email);
    const actual = await ctx.dataSource.getRepository(GrupoMateria).findOneByOrFail({ id: ctx.grupoMateriaIdMaestro });
    const pasado = await ctx.dataSource.getRepository(CicloEscolar).findOneOrFail({ where: { activo: false } });
    const grupoPasado = await ctx.dataSource.getRepository(Grupo).save(ctx.dataSource.getRepository(Grupo).create({ cicloId: pasado.id, plantelId: ctx.plantelId, nombre: `H${ctx.sufijo}`, activo: false }));
    const gmPasado = await ctx.dataSource.getRepository(GrupoMateria).save(ctx.dataSource.getRepository(GrupoMateria).create({ grupoId: grupoPasado.id, materiaId: actual.materiaId }));
    await ctx.dataSource.getRepository(Inscripcion).save(ctx.dataSource.getRepository(Inscripcion).create({ alumnoId: ctx.alumnoId, grupoId: grupoPasado.id, estatus: 'BAJA' }));
    await ctx.dataSource.getRepository(Calificacion).save(ctx.dataSource.getRepository(Calificacion).create({ alumnoId: ctx.alumnoId, grupoMateriaId: gmPasado.id, parcial: 1, calificacion: 17, capturadaPorId: ctx.adminId }));
    for (const [parcial, calificacion] of [[1, 60], [2, 90], [3, 90], [0, 100]]) expect((await ctx.api('/calificaciones/captura', { method: 'POST', token,
      body: { grupoMateriaId: actual.id, parcial, motivo: 'Prueba de regla oficial', items: [{ alumnoId: ctx.alumnoId, calificacion }] } })).response.status).toBe(201);
    const notas = await ctx.api('/calificaciones/mias', { token: movil });
    expect(notas.data.some((c: { grupoMateriaId: number }) => c.grupoMateriaId === gmPasado.id)).toBe(false);
    expect(notas.data.filter((c: { grupoMateriaId: number }) => c.grupoMateriaId === actual.id).map((c: { promedioOficial: number }) => c.promedioOficial)).toEqual([80, 80, 80, 80]);
    const historicas = await ctx.api(`/calificaciones/mias?cicloId=${pasado.id}`, { token: movil });
    expect(historicas.data.map((c: { grupoMateriaId: number }) => c.grupoMateriaId)).toEqual([gmPasado.id]);
    const sinNota = await ctx.api('/alumnos', { method: 'POST', token, body: { nombre: 'Sin', apellidoPaterno: 'Nota', matricula: `SN${ctx.sufijo}`,
      email: `sinnota_${ctx.sufijo}@example.invalid`, password: 'Integracion_Segura_42!', plantelId: ctx.plantelId } });
    expect((await ctx.api(`/academico/grupos/${actual.grupoId}/alumnos`, { method: 'POST', token, body: { alumnoId: sinNota.data.id } })).response.status).toBe(201);
    const response = await fetch(`${ctx.baseUrl}/reportes/grupo-materias/${actual.id}/calificaciones.xlsx`, { headers: { authorization: `Bearer ${token}` } });
    expect(response.status).toBe(200);
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(Buffer.from(await response.arrayBuffer()) as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    const rows: unknown[][] = []; workbook.worksheets[0].eachRow((row) => rows.push(row.values as unknown[]));
    expect(rows.some((row) => row.includes(`SN${ctx.sufijo}`.toUpperCase()))).toBe(true);
    const matricula = (await ctx.dataSource.getRepository(Alumno).findOneByOrFail({ id: ctx.alumnoId })).matricula;
    const fila = rows.find((row) => row.includes(matricula));
    expect(fila?.slice(3)).toEqual([60, 90, 90, 100, 80]);
    const propia = await ctx.dataSource.getRepository(Inscripcion).findOneByOrFail({ alumnoId: ctx.alumnoId, grupoId: actual.grupoId });
    const pdf = await fetch(`${ctx.baseUrl}/reportes/boleta/${ctx.alumnoId}?cicloId=${actual.grupo.cicloId}&inscripcionId=${propia.id}`, { headers: { authorization: `Bearer ${token}` } });
    expect(pdf.status).toBe(200); expect(pdf.headers.get('content-type')).toContain('application/pdf');
  });
  },
  36: (ctx) => {
it('promueve alumnos seleccionados a preparación sin copiar notas ni habilitar el ciclo', async () => {
    const admin = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.adminId })).email);
    const source = await ctx.dataSource.getRepository(CicloEscolar).findOneOrFail({ where: { estado: 'CERRADO' } });
    const grupoOrigen = await ctx.dataSource.getRepository(Grupo).save(ctx.dataSource.getRepository(Grupo).create({ cicloId: source.id, plantelId: ctx.plantelId, nombre: `PRO${ctx.sufijo}`, activo: false }));
    await ctx.dataSource.getRepository(Inscripcion).insert({ grupoId: grupoOrigen.id, alumnoId: ctx.alumnoId, estatus: 'ACTIVA' });
    const ciclo = await ctx.api('/academico/ciclos', { method: 'POST', token: admin, body: { clave: `PR${ctx.sufijo}`, nombre: 'Siguiente ciclo', fechaInicio: '2031-08-01', fechaFin: '2032-07-31' } }); expect(ciclo.response.status).toBe(201);
    const destino = await ctx.api('/academico/grupos', { method: 'POST', token: admin, body: { cicloId: ciclo.data.id, plantelId: ctx.plantelId, nombre: `DEST${ctx.sufijo}` } }); expect(destino.response.status).toBe(201);
    const contexto = { origenGrupoId: grupoOrigen.id, destinoGrupoId: destino.data.id };
    const preview = await ctx.api('/academico/promocion/preview', { method: 'POST', token: admin, body: contexto }); expect(preview.response.status).toBe(201); expect(preview.data.alumnos).toEqual(expect.arrayContaining([expect.objectContaining({ id: ctx.alumnoId, elegible: true })]));
    const confirmacion = await ctx.api('/academico/promocion/confirmar', { method: 'POST', token: admin, body: { ...contexto, alumnoIds: [ctx.alumnoId], confirmado: true } }); expect(confirmacion.response.status).toBe(201); expect(confirmacion.data.inscritos).toBe(1);
    expect(await ctx.dataSource.getRepository(Inscripcion).countBy({ grupoId: destino.data.id, alumnoId: ctx.alumnoId, estatus: 'ACTIVA' })).toBe(1);
    expect((await ctx.dataSource.getRepository(CicloEscolar).findOneByOrFail({ id: ciclo.data.id })).activo).toBe(false);
    expect((await ctx.api('/academico/promocion/confirmar', { method: 'POST', token: admin, body: { ...contexto, alumnoIds: [ctx.alumnoId], confirmado: true } })).response.status).toBe(409);
    expect(await ctx.dataSource.getRepository(BitacoraAcademica).countBy({ accion: 'PROMOCION_ALUMNO', entidadId: ctx.alumnoId })).toBe(1);
  });
  },
  53: (ctx) => {
    it('cierre y captura concurrentes no permiten escribir después del cierre', async () => {
      const token = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.adminId })).email);
      const base = await ctx.dataSource.getRepository(GrupoMateria).findOneByOrFail({ id: ctx.grupoMateriaIdMaestro });
      const grupo = await ctx.dataSource.getRepository(Grupo).save({ nombre: `CC-${ctx.sufijo}`,cicloId: base.grupo.cicloId,plantelId: ctx.plantelId,activo: true });
      const gm = await ctx.dataSource.getRepository(GrupoMateria).save({ grupoId: grupo.id,materiaId: base.materiaId,docenteId: null });
      const alta = await ctx.api('/alumnos',{ method: 'POST',token,body: { email: `cc_${ctx.sufijo}@example.invalid`,nombre: 'Carrera',apellidoPaterno: 'Calificaciones',password: 'Integracion_Segura_42!',matricula: `CC${ctx.sufijo}`,plantelId: ctx.plantelId } }); expect(alta.response.status).toBe(201);
      expect((await ctx.api(`/academico/grupos/${grupo.id}/alumnos`,{ method: 'POST',token,body: { alumnoId: alta.data.id } })).response.status).toBe(201);
      const body = { grupoMateriaId: gm.id,parcial: 1,items: [{ alumnoId: alta.data.id,calificacion: 80 }] };
      expect((await ctx.api('/calificaciones/captura',{ method: 'POST',token,body })).response.status).toBe(201);
      const respuestas = await Promise.all([ctx.api(`/calificaciones/periodos/${gm.id}/1`,{ method: 'PATCH',token,body: { estatus: 'CERRADO' } }),ctx.api('/calificaciones/captura',{ method: 'POST',token,body: { ...body,motivo: 'Corrección concurrente autorizada',items: [{ alumnoId: alta.data.id,calificacion: 90 }] } })]);
      expect(respuestas[0].response.status).toBe(200); expect([201,409]).toContain(respuestas[1].response.status);
      const nota = await ctx.dataSource.getRepository(Calificacion).findOneByOrFail({ alumnoId: alta.data.id,grupoMateriaId: gm.id,parcial: 1 });
      expect(Number(nota.calificacion)).toBe(respuestas[1].response.status === 201 ? 90 : 80);
      expect((await ctx.api('/calificaciones/captura',{ method: 'POST',token,body: { ...body,motivo: 'Cambio tardío',items: [{ alumnoId: alta.data.id,calificacion: 95 }] } })).response.status).toBe(409);
    });
  },
};
