import { mkdtemp, readFile, rm, mkdir, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { gzipSync, gunzipSync } from 'zlib';
import { createHash } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager } from 'typeorm';
import { stub } from '../test-utils/stub';
import { ArchivoEgresosService } from './archivo-egresos.service';
import { EgresoAlumno, Inscripcion, Calificacion, HistorialCalificacion, ParticipacionAsignatura, CalificacionRecursamiento, HistorialRecursamiento, GrupoMateria } from '../entities';

function entorno(raiz:string, archivado=false) {
 const detalleCalculo=JSON.stringify({criterios:[{nombre:'Tarea',porcentaje:33.33},{nombre:'Examen',porcentaje:66.67}],notas:[7.01,8.02],calificacion:7.683367});
 const egreso={id:9,estadoArchivo:archivado?'ARCHIVADO':'VIGENTE',archivarDesde:new Date('2032-01-01'),fechaEgreso:new Date('2027-01-01T12:00:00Z'),fechaDocumental:'2027-01-01',cicloId:2,ciclo:{clave:'2026'},alumno:{id:1,matricula:'QA-ARCHIVO',estatus:'EGRESADO',plantelId:3,usuario:{nombre:'Archivo',apellidoPaterno:'Sintético'}}};
 const egresos={find:jest.fn().mockResolvedValue([{id:9}]),findOne:jest.fn().mockResolvedValue(egreso),update:jest.fn()};
 const repos=new Map<unknown,object>([
  [EgresoAlumno,egresos], [Inscripcion,{find:jest.fn().mockResolvedValue([])}],
  [Calificacion,{find:jest.fn().mockResolvedValue([{id:1,grupoMateriaId:4,parcial:1,calificacion:85.33,escalaMaxima:100,capturadaPorId:5},{id:2,grupoMateriaId:4,parcial:2,calificacion:7.683367,escalaMaxima:10}])}],
  [HistorialCalificacion,{find:jest.fn().mockResolvedValue([{id:1,grupoMateriaId:4,calificacionId:1,parcial:1,valorAnterior:85.33,valorNuevo:7.683367,escalaAnterior:100,escalaNueva:10,detalleCalculo,usuarioId:5,observacionAnterior:'Anterior',observacionNueva:'Corregida'}])}],
  [ParticipacionAsignatura,{find:jest.fn().mockResolvedValue([{id:7,grupoMateriaId:4,intento:1,estado:'FINALIZADA'}])}],
  [CalificacionRecursamiento,{find:jest.fn().mockResolvedValue([{participacionId:7,parcial:1,calificacion:8,escalaMaxima:100},{participacionId:7,parcial:2,calificacion:8,escalaMaxima:10}])}],
  [HistorialRecursamiento,{find:jest.fn().mockResolvedValue([{participacionId:7,parcial:1,anterior:8,nueva:8,escalaAnterior:100,escalaNueva:10}])}],
  [GrupoMateria,{find:jest.fn().mockResolvedValue([{id:4,regimenEvaluacion:'CUATRO_PARCIALES_10'}])}],
 ]);
 const getRepository=jest.fn((entity:unknown)=>{const r=repos.get(entity);if(!r)throw new Error('Repositorio no previsto');return r;});
 const manager=stub<EntityManager>({getRepository});
 const ds=stub<DataSource>({getRepository,transaction:jest.fn((fn:(m:EntityManager)=>Promise<unknown>)=>fn(manager))});
 return {service:new ArchivoEgresosService(ds,new ConfigService({EGRESOS_ARCHIVO_AUTOMATICO:'true',EGRESOS_ARCHIVE_DIR:raiz})),egresos,getRepository,detalleCalculo};
}
interface Exportacion {esquema:string;calificaciones:Record<string,unknown>[];revisiones:Record<string,unknown>[];notasRecursamiento:Record<string,unknown>[];revisionesRecursamiento:Record<string,unknown>[];regimenesEvaluacion:Record<string,unknown>[]}

it('el comprimido v2 conserva escalas mixtas, regímenes e instantáneas sin modificar notas',async()=>{
 const raiz=await mkdtemp(join(tmpdir(),'egreso-v2-'));
 jest.useFakeTimers({now:new Date('2034-01-01'),doNotFake:['nextTick','queueMicrotask','setImmediate']});
 try {
  const ctx=entorno(raiz);expect(await ctx.service.procesar()).toBe(1);
  const archivo=await readFile(join(raiz,'ciclo_2_2026','egreso_9.json.gz'));
  const d:Exportacion=JSON.parse(gunzipSync(archivo).toString('utf8'));
  expect(d.esquema).toBe('expediente-egreso-iua/v2');
  expect(d.calificaciones).toEqual([expect.objectContaining({calificacion:85.33,escalaMaxima:100,regimenEvaluacion:'CUATRO_PARCIALES_10'}),expect.objectContaining({calificacion:7.683367,escalaMaxima:10})]);
  expect(d.regimenesEvaluacion).toEqual([{grupoMateriaId:4,regimenEvaluacion:'CUATRO_PARCIALES_10'}]);
  expect(d.revisiones[0]).toMatchObject({valorAnterior:85.33,valorNuevo:7.683367,escalaAnterior:100,escalaNueva:10,detalleCalculo:ctx.detalleCalculo,usuarioId:5,observacionAnterior:'Anterior',observacionNueva:'Corregida'});
  expect(d.notasRecursamiento.map(n=>n.escalaMaxima)).toEqual([100,10]);
  expect(d.revisionesRecursamiento[0]).toMatchObject({anterior:8,nueva:8,escalaAnterior:100,escalaNueva:10});
  expect(ctx.egresos.update).toHaveBeenCalledWith(9,expect.objectContaining({estadoArchivo:'ARCHIVADO',sha256Archivo:createHash('sha256').update(archivo).digest('hex')}));
 }finally{jest.useRealTimers();await rm(raiz,{recursive:true,force:true});}
});
it('conserva un comprimido v1 ya archivado y no consulta ni reescribe sus notas',async()=>{
 const raiz=await mkdtemp(join(tmpdir(),'egreso-v1-'));
 try {
  const carpeta=join(raiz,'ciclo_2_2026');await mkdir(carpeta);const ruta=join(carpeta,'egreso_9.json.gz');const previo=gzipSync(Buffer.from('{"esquema":"expediente-egreso-iua/v1"}'));await writeFile(ruta,previo);
  const ctx=entorno(raiz,true);expect(await ctx.service.procesar()).toBe(0);expect(await readFile(ruta)).toEqual(previo);expect(ctx.egresos.update).not.toHaveBeenCalled();expect(ctx.getRepository.mock.calls.every(([entity])=>entity===EgresoAlumno)).toBe(true);
 }finally{await rm(raiz,{recursive:true,force:true});}
});
