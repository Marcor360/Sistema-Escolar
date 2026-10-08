import { ContextoIntegracion } from './contexto';
import { expect, it } from '@jest/globals';
import * as ExcelJS from 'exceljs';
import * as bcrypt from 'bcryptjs';
import { Alumno, BitacoraAcademica, Usuario } from '../../src/entities';
export const casos_importaciones: Record<number, (ctx: ContextoIntegracion) => void> = {
  33: (ctx) => {
it('importa con preview ligado al actor, valida duplicados y confirma una sola vez', async () => {
    const admin = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.adminId })).email);
    const superadmin = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.superadminId })).email);
    const enviar = (texto: string) => { const f = new FormData(); f.append('tipo', 'ALUMNOS'); f.append('archivo', new Blob([texto]), 'alumnos.csv'); return ctx.api('/importaciones/preview', { method: 'POST', token: admin, body: f }); };
    const email = `importado_${ctx.sufijo}@example.invalid`;
    const fila = `${email},Importado,Prueba,IMP${ctx.sufijo},${ctx.plantelId}`;
    const csv = 'email,nombre,apellidoPaterno,matricula,plantelId\n' + fila;
    const duplicado = await enviar(csv + '\n' + fila); expect(duplicado.response.status).toBe(201); expect(duplicado.data.previewId).toBeNull(); expect(duplicado.data.errores).toHaveLength(1);
    expect(await ctx.dataSource.getRepository(Usuario).findOneBy({ email })).toBeNull();
    const preview = await enviar(csv); expect(preview.response.status).toBe(201); expect(preview.data.errores).toEqual([]);
    expect((await ctx.api('/importaciones/confirmar', { method: 'POST', token: superadmin, body: { previewId: preview.data.previewId, confirmado: true } })).response.status).toBe(404);
    const confirmado = await ctx.api('/importaciones/confirmar', { method: 'POST', token: admin, body: { previewId: preview.data.previewId, confirmado: true } }); expect(confirmado.response.status).toBe(201); expect(confirmado.data.insertados).toBe(1);
    expect((await ctx.api('/importaciones/confirmar', { method: 'POST', token: admin, body: { previewId: preview.data.previewId, confirmado: true } })).response.status).toBe(404);
    const cuenta = await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ email }); expect(cuenta.passwordChangeRequired).toBe(true);
    expect(await ctx.dataSource.getRepository(Alumno).countBy({ usuarioId: cuenta.id })).toBe(1);
    expect(await ctx.dataSource.getRepository(BitacoraAcademica).countBy({ accion: 'IMPORTAR_ALUMNOS' })).toBe(1);
  });
  },
  35: (ctx) => {
it('revierte el lote completo si surge un duplicado después del preview', async () => {
    const admin = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.adminId })).email);
    const email1 = `atomic1_${ctx.sufijo}@example.invalid`; const email2 = `atomic2_${ctx.sufijo}@example.invalid`;
    const f = new FormData(); f.append('tipo', 'ALUMNOS'); f.append('archivo', new Blob([`email,nombre,apellidoPaterno,matricula,plantelId\n${email1},Primero,Lote,AT1${ctx.sufijo},${ctx.plantelId}\n${email2},Segundo,Lote,AT2${ctx.sufijo},${ctx.plantelId}`]), 'lote.csv');
    const preview = await ctx.api('/importaciones/preview', { method: 'POST', token: admin, body: f }); expect(preview.data.errores).toEqual([]);
    expect((await ctx.api('/alumnos', { method: 'POST', token: admin, body: { email: email2, password: 'Integracion_Segura_42!', nombre: 'Segundo', apellidoPaterno: 'Concurrente', matricula: `OT2${ctx.sufijo}`, plantelId: ctx.plantelId } })).response.status).toBe(201);
    expect((await ctx.api('/importaciones/confirmar', { method: 'POST', token: admin, body: { previewId: preview.data.previewId, confirmado: true } })).response.status).toBe(409);
    expect(await ctx.dataSource.getRepository(Usuario).findOneBy({ email: email1 })).toBeNull(); expect(await ctx.dataSource.getRepository(Alumno).countBy({ matricula: `AT1${ctx.sufijo}`.toUpperCase() })).toBe(0);
    expect(await ctx.dataSource.getRepository(BitacoraAcademica).countBy({ accion: 'IMPORTAR_ALUMNOS' })).toBe(1);
  });
  },
};
