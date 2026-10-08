import { ContextoIntegracion } from './contexto';
import { expect,it } from '@jest/globals';
import { CicloEscolar,Inscripcion,Calificacion,Usuario } from '../../src/entities';
import * as ExcelJS from 'exceljs';
/** Se registra después de los navegadores: el único ciclo global se aísla con fixtures sintéticos. */
export function registrarCicloOperativo(ctx: ContextoIntegracion) {
  it('recorrido académico completo: inscripción, transferencia, evaluación, cierre y promoción conservando histórico', async () => {
    const token = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.superadminId })).email);
    const activos = await ctx.dataSource.getRepository(CicloEscolar).findBy({ activo: true });
    // Solo esta base nueva de integración. El aislamiento no es una operación institucional de cierre.
    for (const c of activos) await ctx.dataSource.getRepository(CicloEscolar).update(c.id,{ activo: false });
    const ciclosCreados: number[] = [];
    const post = (ruta: string,body: unknown) => ctx.api(ruta,{ method: 'POST',token,body });
    try {
      const ciclo = await post('/academico/ciclos',{ clave: `OC${ctx.sufijo}`,nombre: 'Ciclo operativo completo',fechaInicio: '2038-08-01',fechaFin: '2039-07-31' }); expect(ciclo.response.status).toBe(201); ciclosCreados.push(ciclo.data.id);
      const docente = await post('/docentes',{ email: `ocdoc_${ctx.sufijo}@example.invalid`,nombre: 'Docente',apellidoPaterno: 'Operativo',numEmpleado: `OC${ctx.sufijo}`,password: 'Integracion_Segura_42!',plantelIds: [ctx.plantelId,ctx.otroPlantelId] }); expect(docente.response.status).toBe(201);
      const alumno = await post('/alumnos',{ email: `ocal_${ctx.sufijo}@example.invalid`,nombre: 'Alumno',apellidoPaterno: 'Operativo',matricula: `OC${ctx.sufijo}`,password: 'Integracion_Segura_42!',plantelId: ctx.plantelId }); expect(alumno.response.status).toBe(201);
      const materia = await post('/academico/materias',{ clave: `OC${ctx.sufijo}`,nombre: 'Materia operativa',creditos: 0 }); expect(materia.response.status).toBe(201);
      const grupoA = await post('/academico/grupos',{ cicloId: ciclo.data.id,plantelId: ctx.plantelId,nombre: 'Operativo A' }); const grupoB = await post('/academico/grupos',{ cicloId: ciclo.data.id,plantelId: ctx.otroPlantelId,nombre: 'Operativo B' }); expect(grupoA.response.status).toBe(201); expect(grupoB.response.status).toBe(201);
      const claseA = await post(`/academico/grupos/${grupoA.data.id}/materias`,{ materiaId: materia.data.id,docenteId: docente.data.id }); const claseB = await post(`/academico/grupos/${grupoB.data.id}/materias`,{ materiaId: materia.data.id,docenteId: docente.data.id }); expect(claseA.response.status).toBe(201); expect(claseB.response.status).toBe(201);
      expect((await post(`/academico/ciclos/${ciclo.data.id}/activar`,{ confirmado: true })).response.status).toBe(201);
      const inscripcionA = await post(`/academico/grupos/${grupoA.data.id}/alumnos`,{ alumnoId: alumno.data.id }); expect(inscripcionA.response.status).toBe(201);
      expect((await ctx.api(`/alumnos/${alumno.data.id}`,{ method: 'PATCH',token,body: { plantelId: ctx.otroPlantelId } })).response.status).toBe(400);
      expect((await post(`/alumnos/${alumno.data.id}/transferencia`,{ plantelId: ctx.otroPlantelId })).response.status).toBe(201);
      expect(await ctx.dataSource.getRepository(Inscripcion).countBy({ alumnoId: alumno.data.id,grupoId: grupoA.data.id,estatus: 'ACTIVA' })).toBe(0);
      const inscripcionB = await post(`/academico/grupos/${grupoB.data.id}/alumnos`,{ alumnoId: alumno.data.id }); expect(inscripcionB.response.status).toBe(201);
      expect((await post(`/academico/grupos/${grupoB.data.id}/alumnos`,{ alumnoId: alumno.data.id })).response.status).toBe(409);
      for (const parcial of [1,2,3]) {
        expect((await post('/calificaciones/captura',{ grupoMateriaId: claseB.data.id,parcial,items: [{ alumnoId: alumno.data.id,calificacion: [80,90,100][parcial-1] }] })).response.status).toBe(201);
        expect((await ctx.api(`/calificaciones/periodos/${claseB.data.id}/${parcial}`,{ method: 'PATCH',token,body: { estatus: 'CERRADO' } })).response.status).toBe(200);
      }
      const alumnoToken = await ctx.emitirToken(`ocal_${ctx.sufijo}@example.invalid`);
      const notas = await ctx.api('/calificaciones/mias',{ token: alumnoToken }); expect(notas.data).toHaveLength(3); expect(notas.data.every((n: { promedioOficial: number }) => n.promedioOficial === 90)).toBe(true);
      const pdf = await fetch(`${ctx.baseUrl}/reportes/boleta/${alumno.data.id}?cicloId=${ciclo.data.id}&inscripcionId=${inscripcionB.data.id}`,{ headers: { authorization: `Bearer ${token}` } }); expect(pdf.status).toBe(200); expect(Buffer.from(await pdf.arrayBuffer()).subarray(0,4).toString()).toBe('%PDF');
      const excel = await fetch(`${ctx.baseUrl}/reportes/grupo-materias/${claseB.data.id}/calificaciones.xlsx`,{ headers: { authorization: `Bearer ${token}` } }); expect(excel.status).toBe(200); const libro = new ExcelJS.Workbook(); await libro.xlsx.load(Buffer.from(await excel.arrayBuffer()) as any); expect(JSON.stringify(libro.worksheets[0].getSheetValues())).toContain(`OC${ctx.sufijo}`.toUpperCase()); expect(JSON.stringify(libro.worksheets[0].getSheetValues())).toContain('90');
      expect((await post(`/academico/ciclos/${ciclo.data.id}/iniciar-cierre`,{ confirmado: true })).response.status).toBe(201);
      const resumen = await ctx.api(`/academico/ciclos/${ciclo.data.id}/cierre`,{ token }); expect(resumen.data).toMatchObject({ inscritos: 1,faltantes: [],puedeCerrar: true });
      expect((await post(`/academico/ciclos/${ciclo.data.id}/cerrar`,{ confirmado: true })).response.status).toBe(201);
      expect((await post('/calificaciones/captura',{ grupoMateriaId: claseB.data.id,parcial: 1,motivo: 'Cambio tardío',items: [{ alumnoId: alumno.data.id,calificacion: 95 }] })).response.status).toBe(409);
      const futuro = await post('/academico/ciclos',{ clave: `OF${ctx.sufijo}`,nombre: 'Siguiente ciclo operativo',fechaInicio: '2039-08-01',fechaFin: '2040-07-31' }); expect(futuro.response.status).toBe(201); ciclosCreados.push(futuro.data.id);
      const destino = await post('/academico/grupos',{ cicloId: futuro.data.id,plantelId: ctx.otroPlantelId,nombre: 'Operativo promovido' }); expect(destino.response.status).toBe(201);
      const promover = { origenGrupoId: grupoB.data.id,destinoGrupoId: destino.data.id };
      const preview = await post('/academico/promocion/preview',promover); expect(preview.response.status).toBe(201); expect(preview.data.alumnos).toEqual([expect.objectContaining({ id: alumno.data.id,elegible: true })]);
      expect((await post('/academico/promocion/confirmar',{ ...promover,alumnoIds: [alumno.data.id],confirmado: true })).data.inscritos).toBe(1);
      expect((await post('/academico/promocion/confirmar',{ ...promover,alumnoIds: [alumno.data.id],confirmado: true })).response.status).toBe(409);
      expect(await ctx.dataSource.getRepository(Inscripcion).countBy({ alumnoId: alumno.data.id,grupoId: destino.data.id,estatus: 'ACTIVA' })).toBe(1);
      expect(await ctx.dataSource.getRepository(Calificacion).countBy({ alumnoId: alumno.data.id,grupoMateriaId: claseB.data.id })).toBe(3);
      expect((await post(`/academico/ciclos/${futuro.data.id}/activar`,{ confirmado: true })).response.status).toBe(201);
      const vigentes = await ctx.api('/calificaciones/mias',{ token: alumnoToken }); expect(vigentes.data).toEqual([]);
      const historicas = await ctx.api(`/calificaciones/mias?cicloId=${ciclo.data.id}`,{ token: alumnoToken }); expect(historicas.data).toHaveLength(3); expect(historicas.data.every((n: { promedioOficial: number }) => n.promedioOficial === 90)).toBe(true);
    } finally {
      for (const id of ciclosCreados) await ctx.dataSource.getRepository(CicloEscolar).update(id,{ activo: false });
      for (const c of activos) await ctx.dataSource.getRepository(CicloEscolar).update(c.id,{ activo: true });
    }
  });
}
