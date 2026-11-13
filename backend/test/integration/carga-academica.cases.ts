import { expect, it } from '@jest/globals';
import { ContextoIntegracion } from './contexto';
import { CicloEscolar, Grupo, ImportacionFila, Inscripcion, Materia, Usuario } from '../../src/entities';

export function registrarCargaAcademica(ctx: ContextoIntegracion) {
  it('carga masiva: materias, duplicados, autorización, preview cifrado y confirmación única', async()=>{
    const token=async(id:number)=>ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({id})).email);
    const root=await token(ctx.superadminId), fin=await token(ctx.finanzasId), admin=await token(ctx.adminId);
    const preview=async(texto:string,t=root)=>{const f=new FormData();f.append('tipo','MATERIAS');f.append('archivo',new Blob([texto]),'materias.csv');return ctx.api('/importaciones/preview',{method:'POST',token:t,body:f});};
    const clave=`IMP${ctx.sufijo}`;
    const csv=`clave,nombre,creditos,tipo\n${clave},Materia carga QA,4,OBLIGATORIA\n${clave},Repetida,4,OBLIGATORIA`;
    expect((await preview(csv,fin)).response.status).toBe(403);
    const invalido=await preview(csv+'\nINVALIDA,Inválida,-1,OTRA');
    expect(invalido.data.errores).toHaveLength(1);expect(invalido.data.previewId).toBeNull();
    const p=await preview(csv);expect(p.response.status).toBe(201);expect(p.data.validos).toBe(1);expect(p.data.duplicados).toHaveLength(1);
    expect(await ctx.dataSource.getRepository(Materia).existsBy({clave})).toBe(false);
    const filas=await ctx.dataSource.getRepository(ImportacionFila).findBy({previewId:p.data.previewId});expect(filas[0].contenido).not.toContain('Materia carga QA');
    expect((await ctx.api('/importaciones/confirmar',{method:'POST',token:admin,body:{previewId:p.data.previewId,confirmado:true}})).response.status).toBe(404);
    expect((await ctx.api('/importaciones/confirmar',{method:'POST',token:root,body:{previewId:p.data.previewId,confirmado:false}})).response.status).toBe(400);
    const resultados=await Promise.all([1,2].map(()=>ctx.api('/importaciones/confirmar',{method:'POST',token:root,body:{previewId:p.data.previewId,confirmado:true}})));
    expect(resultados.filter(r=>r.response.status===201)).toHaveLength(1);
    expect(resultados.find(r=>r.response.status===201)!.data).toMatchObject({insertados:1,existentes:1,activacion:null});
    expect(await ctx.dataSource.getRepository(Materia).countBy({clave})).toBe(1);
    const repetido=await preview(csv);expect(repetido.data.validos).toBe(0);expect(repetido.data.duplicados).toHaveLength(2);expect(repetido.data.previewId).toBeNull();
  });

  it('carga masiva: grupos con contexto, revalidación, alcance y resumen académico agregado',async()=>{
    const token=async(id:number)=>ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({id})).email);
    const root=await token(ctx.superadminId), admin=await token(ctx.adminId), fin=await token(ctx.finanzasId);
    const post=async(ruta:string,body:unknown)=>{const r=await ctx.api(ruta,{method:'POST',token:root,body});expect(r.response.status).toBe(201);return r.data;};
    const ciclo=await post('/academico/ciclos',{clave:`IMC${ctx.sufijo}`,nombre:'Ciclo carga',fechaInicio:'2055-01-01',fechaFin:'2055-12-31'});
    const nivel=await post('/academico/catalogos/niveles',{plantelId:ctx.plantelId,clave:`IN${ctx.sufijo}`,nombre:'Nivel carga'});
    const carrera=await post('/academico/catalogos/carreras',{plantelId:ctx.plantelId,nivelId:nivel.id,clave:`IC${ctx.sufijo}`,nombre:'Carrera carga',versionPlan:'Plan QA'});
    const periodo=await post('/academico/catalogos/periodos',{plantelId:ctx.plantelId,carreraId:carrera.id,cicloId:ciclo.id,clave:'S1',nombre:'Periodo carga',tipo:'SEMESTRAL',numero:1});
    const header='plantelId,cicloId,nombre,nivelId,carreraId,periodoAcademicoId';
    const nombre=`Carga ${ctx.sufijo}`, fila=`${ctx.plantelId},${ciclo.id},${nombre},${nivel.id},${carrera.id},${periodo.id}`;
    const preview=async(csv:string,t=admin)=>{const f=new FormData();f.append('tipo','GRUPOS');f.append('archivo',new Blob([csv]),'grupos.csv');return ctx.api('/importaciones/preview',{method:'POST',token:t,body:f});};
    const fuera=await preview(`${header}\n${ctx.otroPlantelId},${ciclo.id},Fuera,,,`);expect(fuera.data.errores).toHaveLength(1);expect(fuera.data.previewId).toBeNull();
    const contexto=await preview(`${header}\n${ctx.plantelId},${ciclo.id},Incompleto,${nivel.id},,`);expect(contexto.data.errores).toHaveLength(1);
    const p=await preview(`${header}\n${fila}\n${fila}`);expect(p.data.errores).toEqual([]);expect(p.data.duplicados).toHaveLength(1);
    await ctx.dataSource.getRepository(CicloEscolar).update(ciclo.id,{estado:'CERRADO'});
    expect((await ctx.api('/importaciones/confirmar',{method:'POST',token:admin,body:{previewId:p.data.previewId,confirmado:true}})).response.status).toBe(409);
    expect(await ctx.dataSource.getRepository(Grupo).existsBy({nombre})).toBe(false);
    await ctx.dataSource.getRepository(CicloEscolar).update(ciclo.id,{estado:'PREPARACION'});
    const r=await ctx.api('/importaciones/confirmar',{method:'POST',token:admin,body:{previewId:p.data.previewId,confirmado:true}});expect(r.response.status).toBe(201);expect(r.data.insertados).toBe(1);
    const g=await ctx.dataSource.getRepository(Grupo).findOneByOrFail({nombre});
    for(const numero of [1,2]){
      const m=await post('/academico/materias',{clave:`IS${numero}${ctx.sufijo}`,nombre:'Materia resumen '+numero});
      await post(`/academico/materias/${m.id}/contextos`,{periodoAcademicoId:periodo.id});
      if(numero===1)await post(`/academico/grupos/${g.id}/materias`,{materiaId:m.id});
    }
    await ctx.dataSource.getRepository(Inscripcion).save({alumnoId:ctx.alumnoId,grupoId:g.id,estatus:'ACTIVA'});
    const resumen=await ctx.api(`/academico/grupos/preparacion?cicloId=${ciclo.id}&plantelId=${ctx.plantelId}`,{token:admin});expect(resumen.response.status).toBe(200);
    expect(resumen.data.datos.find((x:{id:number})=>x.id===g.id).preparacion).toEqual({asignadas:1,sinDocente:1,inscritos:1,esperadas:2,pendientes:1});
    expect((await ctx.api(`/academico/grupos/preparacion?plantelId=${ctx.otroPlantelId}`,{token:admin})).response.status).toBe(403);
    expect((await ctx.api('/academico/grupos/preparacion',{token:fin})).response.status).toBe(403);
  });
}
