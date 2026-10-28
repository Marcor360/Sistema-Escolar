import { crearInscripcionFixture } from './fixtures-inscripcion';
import {expect,it} from '@jest/globals';
import {ContextoIntegracion} from './contexto';
import {Usuario,GrupoMateria,Materia,Calificacion} from '../../src/entities';
export function registrarAlumnoPaginado(ctx:ContextoIntegracion){
 it('alumno: páginas de materias/notas propias, promedio completo, sin datos ajenos y contratos previos intactos',async()=>{
  const root=await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({id:ctx.superadminId})).email);
  const post=async(ruta:string,body:unknown)=>{const r=await ctx.api(ruta,{method:'POST',token:root,body});expect(r.response.status).toBe(201);return r.data;};
  const base=await ctx.dataSource.getRepository(GrupoMateria).findOneByOrFail({id:ctx.grupoMateriaIdMaestro});
  const alumno=await post('/alumnos',{email:`pgal${ctx.sufijo}@example.invalid`,matricula:`PGAL${ctx.sufijo}`,nombre:'Alumno paginado',apellidoPaterno:'Prueba',curp:'GODE561231HDFRRN09',plantelId:ctx.plantelId});
  const grupo=await post('/academico/grupos',{plantelId:ctx.plantelId,cicloId:base.grupo.cicloId,nombre:`PGAL${ctx.sufijo}`});
  await crearInscripcionFixture(ctx,grupo.id,alumno.id);
  const clases:GrupoMateria[]=[];
  for(let i=0;i<12;i++){
   const materia=await ctx.dataSource.getRepository(Materia).save({clave:`${ctx.sufijo}PM${i}`,nombre:`Materia propia ${i}`,creditos:0,activo:true});
   clases.push(await ctx.dataSource.getRepository(GrupoMateria).save({ regimenEvaluacion: 'LEGADO_100',grupoId:grupo.id,materiaId:materia.id,docenteId:null}));
  }
  const token=await ctx.emitirToken(`pgal${ctx.sufijo}@example.invalid`);
  const primera=await ctx.api('/alumnos/me/materias/listado',{token}),segunda=await ctx.api('/alumnos/me/materias/listado?pagina=2',{token});
  expect(primera.response.status).toBe(200);expect(primera.data).toMatchObject({total:12,pagina:1,porPagina:10});expect(primera.data.datos).toHaveLength(10);expect(segunda.data.datos).toHaveLength(2);expect([...primera.data.datos,...segunda.data.datos].map((c:{id:number})=>c.id)).toEqual(clases.map(c=>c.id));
  const notas=ctx.dataSource.getRepository(Calificacion);
  await notas.save([0,1,2,3].map(parcial=>({alumnoId:alumno.id,grupoMateriaId:clases[0].id,parcial,calificacion:parcial===0?60:parcial===1?80:parcial===2?90:100})));
  const otro=await post('/alumnos',{email:`pgpeer${ctx.sufijo}@example.invalid`,matricula:`PGPEER${ctx.sufijo}`,nombre:'Otro alumno',apellidoPaterno:'Prueba',curp:'GODE561231HDFRRN09',plantelId:ctx.plantelId});
  await crearInscripcionFixture(ctx,grupo.id,otro.id);
  await notas.save({alumnoId:otro.id,grupoMateriaId:clases[0].id,parcial:1,calificacion:12});
  const r=await ctx.api('/calificaciones/mias/listado?porPagina=1',{token}),r2=await ctx.api('/calificaciones/mias/listado?porPagina=1&pagina=2',{token});
  expect(r.response.status).toBe(200);expect(r.data).toMatchObject({total:4,porPagina:1,pagina:1});expect(r.data.datos).toHaveLength(1);expect(r.data.datos[0]).toMatchObject({alumnoId:alumno.id,parcial:0,promedioOficial:90});expect(r2.data.datos[0]).toMatchObject({alumnoId:alumno.id,parcial:1,promedioOficial:90});
  for(const ruta of ['/alumnos/me/materias/listado','/calificaciones/mias/listado']){
   expect((await ctx.api(ruta)).response.status).toBe(401);
   const fin=await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({id:ctx.finanzasId})).email);expect((await ctx.api(ruta,{token:fin})).response.status).toBe(403);
   for(const query of ['pagina=0','porPagina=101'])expect((await ctx.api(ruta+'?'+query,{token})).response.status).toBe(400);
  }
  const otroToken=await ctx.emitirToken(`pgpeer${ctx.sufijo}@example.invalid`);const otras=await ctx.api('/calificaciones/mias/listado',{token:otroToken});expect(otras.data.total).toBe(1);expect(otras.data.datos[0]).toMatchObject({alumnoId:otro.id,calificacion:12,promedioOficial:null});
  expect((await ctx.api('/alumnos/me/materias',{token})).data).toHaveLength(12);expect((await ctx.api('/calificaciones/mias',{token})).data).toHaveLength(4);
 });
}
