import { ContextoIntegracion } from './contexto';
import { expect, it } from '@jest/globals';
import * as ExcelJS from 'exceljs';
import * as bcrypt from 'bcryptjs';
import { GrupoMateria, Usuario } from '../../src/entities';
export const casos_conducta: Record<number, (ctx: ContextoIntegracion) => void> = {
  30: (ctx) => {
it('mantiene incidencias exclusivamente internas y restringidas por clase/plantel', async () => {
    const admin = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.adminId })).email);
    const maestro = await ctx.emitirToken(`maestro_scope_${ctx.sufijo}@example.invalid`);
    const alumno = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.alumnoUsuarioId })).email);
    const finanzas = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.finanzasId })).email);
    const clase = await ctx.dataSource.getRepository(GrupoMateria).findOneByOrFail({ id: ctx.grupoMateriaIdMaestro });
    const descripcion = 'Nota interna confidencial de seguimiento';
    const creada = await ctx.api('/conducta/incidencias', { method: 'POST', token: maestro, body: { alumnoId: ctx.alumnoId, grupoId: clase.grupoId, tipo: 'CONVIVENCIA', gravedad: 'LEVE', descripcion, fecha: new Date().toISOString() } });
    expect(creada.response.status).toBe(201);
    expect((await ctx.api('/conducta/incidencias', { token: alumno })).response.status).toBe(403);
    expect((await ctx.api(`/conducta/incidencias/${creada.data.id}`, { token: alumno })).response.status).toBe(403);
    expect((await ctx.api('/conducta/incidencias', { token: finanzas })).response.status).toBe(403);
    expect((await ctx.api(`/conducta/incidencias/${creada.data.id}/seguimientos`, { method: 'POST', token: maestro, body: { nota: 'Seguimiento', motivo: 'Verificación', estado: 'CERRADA' } })).response.status).toBe(403);
    const otroDocente = await ctx.api('/docentes', { method: 'POST', token: admin, body: { email: `interno_${ctx.sufijo}@example.invalid`, password: 'Integracion_Segura_42!', nombre: 'Interno', apellidoPaterno: 'Otro', numEmpleado: `I${ctx.sufijo}`, plantelIds: [ctx.plantelId] } });
    expect(otroDocente.response.status).toBe(201);
    const otroMaestro = await ctx.emitirToken(`interno_${ctx.sufijo}@example.invalid`);
    expect((await ctx.api(`/conducta/incidencias/${creada.data.id}`, { token: otroMaestro })).response.status).toBe(403);
    expect((await ctx.api(`/conducta/incidencias/${creada.data.id}/seguimientos`, { method: 'POST', token: admin, body: { nota: 'Resuelto con seguimiento', motivo: 'Cierre autorizado', estado: 'CERRADA' } })).response.status).toBe(201);
    const detalle = await ctx.api(`/conducta/incidencias/${creada.data.id}`, { token: admin });
    expect(detalle.data.seguimientos).toHaveLength(1); expect(detalle.data.estado).toBe('CERRADA');
    expect(JSON.stringify((await ctx.api('/notificaciones/mias', { token: alumno })).data)).not.toContain(descripcion);
    const listado = await ctx.api('/usuarios/listado?tipo=ALUMNO', { token: maestro });
    expect(listado.response.status).toBe(200); expect(listado.data.datos.length).toBeGreaterThan(0);
    expect(listado.data.datos.every((a: Record<string, unknown>) => !('correo' in a))).toBe(true);
  });
  },
};
