import { beforeAll, describe, expect, it } from '@jest/globals';
import * as bcrypt from 'bcryptjs';
import { basename, resolve } from 'path';
import { readdirSync, statSync } from 'fs';
import { ContextoIntegracion } from './contexto';
import {
  Alumno,
  Usuario,
  Rol,
  Plantel,
  CicloEscolar,
  Grupo,
  Materia,
  GrupoMateria,
  Inscripcion,
  Entrega,
  Calificacion,
  Pago,
  HistorialCalificacion,
  EgresoAlumno,
} from '../../src/entities';
import { MAX_ENTREGA_BYTES } from '../../src/common/upload.config';

export function registrarEntregasConservacion(ctx: ContextoIntegracion) {
  describe('Entregas 100 MiB, texto y conservación sin borrado', () => {
    let root: string, alumnoToken: string, admin: string;
    let alumnoId: number, gmId: number, actividadId: number, legadoId: number, cicloLegadoId: number;
    let ruta: string;
    const curpLegado = 'ZETA900101HDFRRL09';
    beforeAll(async () => {
      const ds = ctx.dataSource;
      root = await ctx.emitirToken((await ds.getRepository(Usuario).findOneByOrFail({ id: ctx.superadminId })).email);
      admin = await ctx.emitirToken((await ds.getRepository(Usuario).findOneByOrFail({ id: ctx.adminId })).email);
      const plantel = await ds
        .getRepository(Plantel)
        .save({ clave: `AE${ctx.sufijo}`, nombre: 'Plantel académico aislado' });
      const ciclo = await ds.getRepository(CicloEscolar).save({
        clave: `AE${ctx.sufijo}`,
        nombre: 'Ciclo entregas',
        fechaInicio: '2026-01-01',
        fechaFin: '2026-12-31',
        estado: 'ACTIVO',
        activo: true,
      });
      const grupo = await ds
        .getRepository(Grupo)
        .save({ plantelId: plantel.id, cicloId: ciclo.id, nombre: 'Entregas QA', activo: true });
      const materia = await ds.getRepository(Materia).save({ clave: `AE${ctx.sufijo}`, nombre: 'Materia de archivos' });
      const gm = await ds.getRepository(GrupoMateria).save({ grupoId: grupo.id, materiaId: materia.id });
      gmId = gm.id;
      const rol = await ds.getRepository(Rol).findOneByOrFail({ clave: 'ALUMNO' });
      const password = 'Integracion_Archivos_42!';
      const usuario = await ds.getRepository(Usuario).save(
        ds.getRepository(Usuario).create({
          email: `archivos_${ctx.sufijo}@example.invalid`,
          nombre: 'Alumno',
          apellidoPaterno: 'Archivos',
          passwordHash: await bcrypt.hash(password, 4),
          roles: [rol],
          activo: true,
          activacionPendiente: false,
        }),
      );
      ctx.passwords.set(usuario.email, password);
      const alumno = await ds.getRepository(Alumno).save({
        usuarioId: usuario.id,
        matricula: `AE${ctx.sufijo}`,
        plantelId: plantel.id,
        curp: 'ZETA090101HDFRRL09',
        estatus: 'ACTIVO',
      });
      alumnoId = alumno.id;
      await ds.getRepository(Inscripcion).save({ alumnoId, grupoId: grupo.id, estatus: 'ACTIVA' });
      alumnoToken = await ctx.emitirToken(usuario.email);
      const actividad = await ctx.api('/actividades', {
        method: 'POST',
        token: root,
        body: { grupoMateriaId: gmId, titulo: 'Entrega de archivo o texto' },
      });
      expect(actividad.response.status).toBe(201);
      actividadId = actividad.data.id;
      const cicloLegado = await ds.getRepository(CicloEscolar).save({
        clave: `LE${ctx.sufijo}`,
        nombre: 'Ciclo legado documentado',
        fechaInicio: '2019-08-01',
        fechaFin: '2020-07-31',
        estado: 'CERRADO',
        activo: false,
      });
      cicloLegadoId = cicloLegado.id;
      const grupoLegado = await ds
        .getRepository(Grupo)
        .save({ plantelId: plantel.id, cicloId: cicloLegado.id, nombre: 'Legado QA', activo: false });
      const usuarioLegado = await ds.getRepository(Usuario).save(
        ds.getRepository(Usuario).create({
          email: `legado_${ctx.sufijo}@example.invalid`,
          nombre: 'Egreso',
          apellidoPaterno: 'Legado',
          passwordHash: await bcrypt.hash(password, 4),
          roles: [rol],
          activo: false,
        }),
      );
      const legado = await ds.getRepository(Alumno).save({
        usuarioId: usuarioLegado.id,
        matricula: `LE${ctx.sufijo}`,
        plantelId: plantel.id,
        curp: curpLegado,
        estatus: 'EGRESADO',
      });
      legadoId = legado.id;
      await ds.getRepository(Inscripcion).save({ alumnoId: legadoId, grupoId: grupoLegado.id, estatus: 'BAJA' });
    });
    it('acepta exactamente 100 MiB y rechaza 100 MiB más un byte sin dejar temporales', async () => {
      const bloque = Buffer.alloc(1024 * 1024, 65);
      const archivo = new Blob(Array.from({ length: 100 }, () => bloque));
      const form = new FormData();
      form.append('archivo', archivo, 'tarea.txt');
      const carga = await ctx.api(`/actividades/${actividadId}/entrega`, {
        method: 'POST',
        token: alumnoToken,
        body: form,
      });
      expect(carga.response.status).toBe(201);
      ruta = carga.data.archivoRuta;
      ctx.archivoPrueba = ruta;
      expect(statSync(resolve(process.env.UPLOADS_DIR!, basename(ruta))).size).toBe(MAX_ENTREGA_BYTES);
      const antes = readdirSync(process.env.UPLOADS_DIR!);
      const grande = new FormData();
      grande.append('archivo', new Blob([archivo, 'a']), 'grande.txt');
      const rechazada = await ctx.api(`/actividades/${actividadId}/entrega`, {
        method: 'POST',
        token: alumnoToken,
        body: grande,
      });
      expect(rechazada.response.status).toBe(413);
      expect(readdirSync(process.env.UPLOADS_DIR!)).toEqual(antes);
    });
    it('guarda 3000 caracteres, conserva adjunto anterior y permite al docente leer el texto', async () => {
      const enviada = await ctx.api(`/actividades/${actividadId}/entrega`, {
        method: 'POST',
        token: alumnoToken,
        body: { respuestaTexto: 'a'.repeat(3000) },
      });
      expect(enviada.response.status).toBe(201);
      expect(enviada.data.respuestaTexto).toHaveLength(3000);
      expect(enviada.data.archivoRuta).toBe(ruta);
      const docente = await ctx.api(`/actividades/${actividadId}/entregas/listado`, { token: root });
      expect(docente.response.status).toBe(200);
      expect(docente.data.datos[0].respuestaTexto).toHaveLength(3000);
      const invalida = await ctx.api(`/actividades/${actividadId}/entrega`, {
        method: 'POST',
        token: alumnoToken,
        body: { respuestaTexto: 'a'.repeat(3001) },
      });
      expect(invalida.response.status).toBe(400);
      expect(
        (await ctx.dataSource.getRepository(Entrega).findOneByOrFail({ alumnoId, actividadId })).respuestaTexto,
      ).toHaveLength(3000);
      expect(statSync(resolve(process.env.UPLOADS_DIR!, basename(ruta))).size).toBe(MAX_ENTREGA_BYTES);
    });
    it('admite una respuesta sin archivo y rechaza entregas vacías y reentregas calificadas', async () => {
      const creada = await ctx.api('/actividades', {
        method: 'POST',
        token: root,
        body: { grupoMateriaId: gmId, titulo: 'Solo texto' },
      });
      const id = creada.data.id;
      expect(
        (await ctx.api(`/actividades/${id}/entrega`, { method: 'POST', token: alumnoToken, body: {} })).response.status,
      ).toBe(400);
      const texto = await ctx.api(`/actividades/${id}/entrega`, {
        method: 'POST',
        token: alumnoToken,
        body: { respuestaTexto: '<script>texto literal</script>' },
      });
      expect(texto.response.status).toBe(201);
      expect(texto.data.archivoRuta).toBeNull();
      expect(
        (
          await ctx.api(`/entregas/${texto.data.id}/calificar`, {
            method: 'PATCH',
            token: root,
            body: { calificacion: 95 },
          })
        ).response.status,
      ).toBe(200);
      expect(
        (
          await ctx.api(`/actividades/${id}/entrega`, {
            method: 'POST',
            token: alumnoToken,
            body: { respuestaTexto: 'Otra' },
          })
        ).response.status,
      ).toBe(409);
    });
    it('el inventario no borra ni expone rutas y respeta rol y plantel', async () => {
      const antes = await ctx.dataSource.getRepository(Entrega).countBy({ alumnoId });
      const revision = await ctx.api(`/alumnos/${alumnoId}/conservacion-adjuntos`, { token: root });
      expect(revision.response.status).toBe(200);
      expect(revision.data.eliminacionHabilitada).toBe(false);
      expect(revision.data.ciclos[0].adjuntos).toBe(1);
      expect(revision.data.pausaDisponible).toBe(false);
      expect(JSON.stringify(revision.data)).not.toContain('/uploads/');
      expect(
        (await ctx.api(`/alumnos/${alumnoId}/conservacion-adjuntos`, { token: alumnoToken })).response.status,
      ).toBe(403);
      expect((await ctx.api(`/alumnos/${alumnoId}/conservacion-adjuntos`, { token: admin })).response.status).toBe(403);
      expect(await ctx.dataSource.getRepository(Entrega).countBy({ alumnoId })).toBe(antes);
      expect(statSync(resolve(process.env.UPLOADS_DIR!, basename(ruta))).size).toBe(MAX_ENTREGA_BYTES);
    });
    it('concilia un egreso legado solo una vez, con datos explícitos y sin alterar originales', async () => {
      const ds = ctx.dataSource;
      const datos = {
        cicloId: cicloLegadoId,
        curp: curpLegado,
        fechaEgreso: '2020-07-31',
        referenciaDocumental: 'Acta sintética QA-2020',
        confirmado: true,
      };
      expect(
        (await ctx.api(`/alumnos/${legadoId}/egreso/conciliacion`, { method: 'POST', token: root, body: {} })).response
          .status,
      ).toBe(400);
      expect(
        (await ctx.api(`/alumnos/${legadoId}/egreso/conciliacion`, { method: 'POST', token: admin, body: datos }))
          .response.status,
      ).toBe(403);
      const antes = {
        inscripciones: await ds.getRepository(Inscripcion).count(),
        notas: await ds.getRepository(Calificacion).count(),
        pagos: await ds.getRepository(Pago).count(),
        revisiones: await ds.getRepository(HistorialCalificacion).count(),
      };
      const respuestas = await Promise.all(
        [1, 2].map(() =>
          ctx.api(`/alumnos/${legadoId}/egreso/conciliacion`, { method: 'POST', token: root, body: datos }),
        ),
      );
      expect(respuestas.map((r) => r.response.status).sort()).toEqual([201, 409]);
      const egreso = await ds.getRepository(EgresoAlumno).findOneByOrFail({ alumnoId: legadoId });
      expect(egreso.fechaDocumental).toBe('2020-07-31');
      expect(await ds.getRepository(EgresoAlumno).countBy({ alumnoId: legadoId })).toBe(1);
      expect({
        inscripciones: await ds.getRepository(Inscripcion).count(),
        notas: await ds.getRepository(Calificacion).count(),
        pagos: await ds.getRepository(Pago).count(),
        revisiones: await ds.getRepository(HistorialCalificacion).count(),
      }).toEqual(antes);
      const alumno = await ds.getRepository(Alumno).findOneByOrFail({ id: legadoId });
      expect(alumno.estatus).toBe('EGRESADO');
      expect(alumno.usuario.activo).toBe(false);
    });
    it('la baja conserva adjuntos y entregas calificadas, sin programar una purga', async () => {
      const ds = ctx.dataSource;
      const antes = await ds.getRepository(Entrega).find({ where: { alumnoId }, order: { id: 'ASC' } });
      const salida = await ctx.api(`/alumnos/${alumnoId}/baja`, { method: 'POST', token: root });
      expect(salida.response.status).toBe(201);
      const despues = await ds.getRepository(Entrega).find({ where: { alumnoId }, order: { id: 'ASC' } });
      expect(
        despues.map((e) => ({ id: e.id, nota: e.calificacion, respuesta: e.respuestaTexto, archivo: e.archivoRuta })),
      ).toEqual(
        antes.map((e) => ({ id: e.id, nota: e.calificacion, respuesta: e.respuestaTexto, archivo: e.archivoRuta })),
      );
      expect(statSync(resolve(process.env.UPLOADS_DIR!, basename(ruta))).size).toBe(MAX_ENTREGA_BYTES);
      expect(await ds.getRepository(Inscripcion).countBy({ alumnoId })).toBe(1);
      expect(
        (await ctx.api(`/alumnos/${alumnoId}/conservacion-adjuntos`, { token: root })).data.eliminacionHabilitada,
      ).toBe(false);
    });
  });
}
