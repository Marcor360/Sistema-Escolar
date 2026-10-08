import { ContextoIntegracion } from './contexto';
import { expect, it } from '@jest/globals';
import * as ExcelJS from 'exceljs';
import * as bcrypt from 'bcryptjs';
import { Alumno, Calificacion, CicloEscolar, Grupo, GrupoMateria, Inscripcion, Materia, Usuario } from '../../src/entities';
export const casos_analitica: Record<number, (ctx: ContextoIntegracion) => void> = {
  32: (ctx) => {
it('analítica mantiene ciclo y roles sin exponer alumnos ni notas internas', async () => {
    const admin = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.adminId })).email);
    const maestro = await ctx.emitirToken(`maestro_scope_${ctx.sufijo}@example.invalid`);
    const alumno = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.alumnoUsuarioId })).email);
    const finanzas = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.finanzasId })).email);
    expect((await ctx.api('/analitica', { token: alumno })).response.status).toBe(403);
    expect((await ctx.api(`/analitica?plantelId=${ctx.otroPlantelId}`, { token: admin })).response.status).toBe(403);
    const resultado = await ctx.api('/analitica', { token: maestro }); expect(resultado.response.status).toBe(200);
    expect(resultado.data.financiero).toBeUndefined(); expect(resultado.data.academico.clases).toHaveLength(1);
    expect(resultado.data.academico.clases[0]).toMatchObject({ grupoMateriaId: ctx.grupoMateriaIdMaestro, promedioOficial: 80, oficialesCompletos: 1 });
    expect(JSON.stringify(resultado.data)).not.toContain('Nota interna confidencial'); expect(JSON.stringify(resultado.data)).not.toContain('@example.invalid');
    const financieros = await ctx.api('/analitica', { token: finanzas }); expect(financieros.response.status).toBe(200); expect(financieros.data.academico).toBeUndefined(); expect(financieros.data.financiero.cargos).toBeGreaterThan(0);
  });
  },
  41: (ctx) => {
it('analítica histórica conserva materia desactivada y participación de alumno de baja', async () => {
    const root = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.superadminId })).email);
    const ciclo = await ctx.dataSource.getRepository(CicloEscolar).save({ clave: `AH${ctx.sufijo}`, nombre: 'Histórico analítico', fechaInicio: '2023-01-01', fechaFin: '2023-12-31', activo: false, estado: 'CERRADO' });
    const grupo = await ctx.dataSource.getRepository(Grupo).save({ cicloId: ciclo.id, plantelId: ctx.plantelId, nombre: 'Histórico', activo: false });
    const materia = await ctx.dataSource.getRepository(Materia).save({ clave: `AH${ctx.sufijo}`, nombre: 'Materia retirada', activo: false, creditos: 0 });
    const clase = await ctx.dataSource.getRepository(GrupoMateria).save({ grupoId: grupo.id, materiaId: materia.id, docenteId: null });
    await ctx.dataSource.getRepository(Inscripcion).save({ alumnoId: ctx.alumnoId, grupoId: grupo.id, estatus: 'BAJA' });
    for (const parcial of [1,2,3]) await ctx.dataSource.getRepository(Calificacion).save({ alumnoId: ctx.alumnoId, grupoMateriaId: clase.id, parcial, calificacion: [80.05, 80.15, 80.25][parcial-1], capturadaPorId: ctx.adminId });
    const resultado = await ctx.api(`/analitica?cicloId=${ciclo.id}`, { token: root }); expect(resultado.response.status).toBe(200); expect(resultado.data.modo).toBe('HISTORICO'); expect(resultado.data.academico.clases).toEqual([expect.objectContaining({ materia: 'Materia retirada', inscritos: 1, participantesHistoricos: 1, inscritosVigentes: 0, promedioOficial: 80.2 })]);
  });
  },
  44: (ctx) => {
it('carga controlada: 100 alumnos, 900 notas y capturas concurrentes sin alterar promedios', async () => {
    const admin = await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.adminId }); const token = await ctx.emitirToken(admin.email);
    const base = await ctx.dataSource.getRepository(GrupoMateria).findOneByOrFail({ id: ctx.grupoMateriaIdMaestro });
    const grupo = await ctx.dataSource.getRepository(Grupo).save({ plantelId: ctx.plantelId, cicloId: base.grupo.cicloId, nombre: `Carga-${ctx.sufijo}`, activo: true });
    const alumnosCarga: number[] = [];
    const passwordHash = await bcrypt.hash('Integracion_Segura_42!', 4);
    for (let i = 0; i < 100; i++) {
      const u = await ctx.dataSource.getRepository(Usuario).save({ email: `carga${i}_${ctx.sufijo}@example.invalid`, nombre: 'Carga', apellidoPaterno: String(i), passwordHash, activo: true });
      const a = await ctx.dataSource.getRepository(Alumno).save({ usuarioId: u.id, plantelId: ctx.plantelId, matricula: `L${i}${ctx.sufijo}`, estatus: 'ACTIVO' }); alumnosCarga.push(a.id);
    }
    await ctx.dataSource.getRepository(Inscripcion).save(alumnosCarga.map((id) => ({ alumnoId: id, grupoId: grupo.id, estatus: 'ACTIVA' as const })));
    const clases: number[] = [];
    for (let i = 0; i < 3; i++) {
      const materia = await ctx.dataSource.getRepository(Materia).save({ clave: `L${i}${ctx.sufijo}`, nombre: `Carga ${i}`, creditos: 0, activo: true });
      clases.push((await ctx.dataSource.getRepository(GrupoMateria).save({ grupoId: grupo.id, materiaId: materia.id, docenteId: null })).id);
    }
    const tiempos: number[] = [];
    for (const parcial of [1,2,3]) await Promise.all(clases.map(async (id) => {
      const desde = Date.now(); const r = await ctx.api('/calificaciones/captura', { method: 'POST', token, body: { grupoMateriaId: id, parcial, items: alumnosCarga.map((alumnoId) => ({ alumnoId, calificacion: 80 })) } });
      tiempos.push(Date.now() - desde); expect(r.response.status).toBe(201);
    }));
    const desde = Date.now(); const resultado = await ctx.api(`/analitica?grupoId=${grupo.id}`, { token }); const analiticaMs = Date.now() - desde;
    expect(resultado.response.status).toBe(200); expect(resultado.data.academico.clases).toHaveLength(3);
    for (const c of resultado.data.academico.clases) expect(c).toMatchObject({ inscritos: 100, oficialesCompletos: 100, promedioOficial: 80 });
    expect(await ctx.dataSource.getRepository(Calificacion).countBy({ grupoMateriaId: require('typeorm').In(clases) })).toBe(900);
    for (const grupoMateriaId of clases) for (const parcial of [1,2,3]) expect((await ctx.api(`/calificaciones/periodos/${grupoMateriaId}/${parcial}`, { method: 'PATCH', token, body: { estatus: 'CERRADO' } })).response.status).toBe(200);
    const root = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.superadminId })).email);
    const cierreDesde = Date.now(); const cierre = await ctx.api(`/academico/ciclos/${base.grupo.cicloId}/cierre`, { token: root }); const cierreMs = Date.now()-cierreDesde;
    expect(cierre.response.status).toBe(200); expect(cierre.data.inscritos).toBeGreaterThanOrEqual(100);
    expect(cierre.data.faltantes.filter((f: { grupoMateriaId: number }) => clases.includes(f.grupoMateriaId))).toEqual([]);
    tiempos.sort((a,b) => a-b); console.log(JSON.stringify({ prueba: 'carga_aislada', motor: process.env.DB_TYPE, alumnos: 100, clases: 3, notas: 900, concurrencia: 3, capturasP95Ms: tiempos[Math.ceil(tiempos.length * .95)-1], analiticaMs, cierreMs }));
  });
  },
};
