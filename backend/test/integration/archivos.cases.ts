import { ContextoIntegracion } from './contexto';
import { expect, it } from '@jest/globals';
import * as ExcelJS from 'exceljs';
import { basename, resolve } from 'path';
import { readdirSync, existsSync } from 'fs';
import * as bcrypt from 'bcryptjs';
import { Grupo, GrupoMateria, Material, Usuario } from '../../src/entities';
export const casos_archivos: Record<number, (ctx: ContextoIntegracion) => void> = {
  18: (ctx) => {
it('entrega materiales solo a un alumno inscrito y sirve el enlace firmado', async () => {
    const admin = await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.adminId });
    const alumnoUsuario = await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.alumnoUsuarioId });
    const tokenAdmin = await ctx.emitirToken(admin.email);
    const tokenAlumno = await ctx.emitirToken(alumnoUsuario.email);
    const grupo = await ctx.dataSource.getRepository(Grupo).findOneByOrFail({ nombre: `G${ctx.sufijo}` });
    const asignacion = await ctx.dataSource.getRepository(GrupoMateria).findOneByOrFail({ grupoId: grupo.id });
    const formulario = new FormData();
    formulario.append('titulo', 'Guía integración');
    formulario.append('archivo', new Blob(['archivo de prueba']), `guía-数学_${ctx.sufijo}.txt`);
    const carga = await ctx.api(`/grupo-materias/${asignacion.id}/materiales`, {
      method: 'POST', token: tokenAdmin, body: formulario,
    });
    expect(carga.response.status).toBe(201);
    expect(carga.data.archivoNombre).toBe(`guía-数学_${ctx.sufijo}.txt`);
    ctx.archivoPrueba = carga.data.archivoRuta;

    const listado = await ctx.api(`/grupo-materias/${asignacion.id}/materiales`, { token: tokenAlumno });
    expect(listado.response.status).toBe(200);
    const enlace = await ctx.api(`/archivos/materiales/${carga.data.id}/enlace`, { token: tokenAlumno });
    expect(enlace.response.status).toBe(200);
    const descarga = await fetch(new URL(enlace.data.url, ctx.baseUrl));
    expect(descarga.status).toBe(200);
    expect(descarga.headers.get('content-disposition')).toContain(encodeURIComponent('guía-数学'));
    expect(await descarga.text()).toBe('archivo de prueba');
    expect((await ctx.api(`/materiales/${carga.data.id}`, { method: 'PATCH', token: tokenAdmin, body: { titulo: 'Guía corregida' } })).response.status).toBe(200);
    const antes = readdirSync(process.env.UPLOADS_DIR!);
    const invalido = new FormData(); invalido.append('titulo', 'x'.repeat(151)); invalido.append('archivo', new Blob(['archivo de prueba']), 'invalido.txt');
    expect((await ctx.api(`/grupo-materias/${asignacion.id}/materiales`, { method: 'POST', token: tokenAdmin, body: invalido })).response.status).toBe(400);
    expect(readdirSync(process.env.UPLOADS_DIR!)).toEqual(antes);
    expect((await ctx.api(`/materiales/${carga.data.id}`, { method: 'DELETE', token: tokenAlumno })).response.status).toBe(403);
    expect((await ctx.api(`/materiales/${carga.data.id}`, { method: 'DELETE', token: tokenAdmin })).response.status).toBe(200);
    expect(await ctx.dataSource.getRepository(Material).findOneBy({ id: carga.data.id })).toBeNull();
    expect(existsSync(resolve(process.env.UPLOADS_DIR!, basename(carga.data.archivoRuta)))).toBe(false);
    ctx.archivoPrueba = undefined;
  });
  },
};
