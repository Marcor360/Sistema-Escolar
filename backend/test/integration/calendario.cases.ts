import { ContextoIntegracion } from './contexto';
import { expect, it } from '@jest/globals';
import * as ExcelJS from 'exceljs';
import * as bcrypt from 'bcryptjs';
import { CicloEscolar, Grupo, Materia, Usuario } from '../../src/entities';
export const casos_calendario: Record<number, (ctx: ContextoIntegracion) => void> = {
  21: (ctx) => {
it('aísla eventos de dos grupos y planteles para alumnos, maestros y administrativo', async () => {
    const ciclo = await ctx.dataSource.getRepository(CicloEscolar).findOneByOrFail({ clave: `C${ctx.sufijo}` });
    const grupoA = await ctx.dataSource.getRepository(Grupo).findOneByOrFail({ nombre: `G${ctx.sufijo}`, plantelId: ctx.plantelId });
    const grupoB = await ctx.dataSource.getRepository(Grupo).findOneByOrFail({ nombre: `Y${ctx.sufijo}`, plantelId: ctx.plantelId });
    const tokenAdmin = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.adminId })).email);
    const tokenSuper = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.superadminId })).email);
    const tokenAlumnoA = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.alumnoUsuarioId })).email);
    const tokenAlumnoB = await ctx.emitirToken(`alumno_otro_grupo_${ctx.sufijo}@example.invalid`);
    const tokenMaestroA = await ctx.emitirToken(`maestro_scope_${ctx.sufijo}@example.invalid`);
    const altaB = await ctx.api('/docentes', { method: 'POST', token: tokenAdmin, body: {
      email: `maestro_b_${ctx.sufijo}@example.invalid`, password: 'Integracion_Segura_42!',
      nombre: 'Maestro', apellidoPaterno: 'B', numEmpleado: `B${ctx.sufijo}`, plantelIds: [ctx.plantelId],
    } });
    expect(altaB.response.status).toBe(201);
    const materia = await ctx.dataSource.getRepository(Materia).findOneByOrFail({ clave: `MAT${ctx.sufijo}` });
    expect((await ctx.api(`/academico/grupos/${grupoB.id}/materias`, { method: 'POST', token: tokenAdmin,
      body: { materiaId: materia.id, docenteId: altaB.data.id } })).response.status).toBe(201);
    const tokenMaestroB = await ctx.emitirToken(`maestro_b_${ctx.sufijo}@example.invalid`);
    const grupoC = await ctx.dataSource.getRepository(Grupo).findOneByOrFail({ cicloId: ciclo.id, plantelId: ctx.otroPlantelId });
    const eventos = [
      { titulo: `GLOBAL-${ctx.sufijo}` }, { titulo: `PLANTEL-${ctx.sufijo}`, plantelId: ctx.plantelId },
      { titulo: `A-${ctx.sufijo}`, grupoId: grupoA.id, plantelId: ctx.plantelId },
      { titulo: `B-${ctx.sufijo}`, grupoId: grupoB.id, plantelId: ctx.plantelId },
      { titulo: `C-${ctx.sufijo}`, grupoId: grupoC.id, plantelId: ctx.otroPlantelId },
    ];
    for (const evento of eventos) expect((await ctx.api('/calendario', { method: 'POST', token: tokenSuper,
      body: { ...evento, fechaInicio: '2026-10-07T12:00:00Z' } })).response.status).toBe(201);
    for (const [token, propios, ajenos] of [
      [tokenAlumnoA, ['GLOBAL', 'PLANTEL', 'A'], ['B', 'C']],
      [tokenAlumnoB, ['GLOBAL', 'PLANTEL', 'B'], ['A', 'C']],
      [tokenMaestroA, ['GLOBAL', 'PLANTEL', 'A'], ['B', 'C']],
      [tokenMaestroB, ['GLOBAL', 'PLANTEL', 'B'], ['A', 'C']],
      [tokenAdmin, ['GLOBAL', 'PLANTEL', 'A', 'B'], ['C']],
    ] as const) {
      const respuesta = await ctx.api('/calendario?desde=2026-10-01&hasta=2026-10-31', { token }); expect(respuesta.response.status).toBe(200);
      const titulos = respuesta.data.map((e: { titulo: string }) => e.titulo);
      for (const titulo of propios) expect(titulos).toContain(`${titulo}-${ctx.sufijo}`);
      for (const titulo of ajenos) expect(titulos).not.toContain(`${titulo}-${ctx.sufijo}`);
    }
    expect((await ctx.api('/calendario', { method: 'POST', token: tokenSuper,
      body: { titulo: 'Fechas invertidas', fechaInicio: '2026-10-08T12:00:00Z', fechaFin: '2026-10-07T12:00:00Z' } })).response.status).toBe(400);
    expect((await ctx.api(`/reportes/boleta/${ctx.alumnoId}`, { token: tokenMaestroA })).response.status).toBe(403);
  });
  },
};
