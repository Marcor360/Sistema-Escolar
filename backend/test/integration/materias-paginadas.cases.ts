import { expect, it } from '@jest/globals';
import { ContextoIntegracion } from './contexto';
import { Materia, Usuario, CicloEscolar, Plantel, GrupoMateria } from '../../src/entities';
export function registrarMateriasPaginadas(ctx: ContextoIntegracion) {
  it('materias: 115 registros paginados, búsqueda fuera de primera página, comodines literales y arreglo compatible', async () => {
    const token = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.superadminId })).email);
    const repo = ctx.dataSource.getRepository(Materia), prefijo = `PG${ctx.sufijo}`;
    await repo.save(Array.from({ length: 115 }, (_, i) => ({ clave: `${prefijo}${String(i).padStart(3, '0')}`, nombre: `Catálogo paginado ${i}`, creditos: 0, activo: true })));
    await repo.save({ clave: `${prefijo}X`, nombre: `Literal %_! ${ctx.sufijo}`, creditos: 0, activo: false });
    const consultar = (extra: string) => ctx.api(`/academico/materias/listado?buscar=${encodeURIComponent(prefijo)}${extra}`, { token });
    const primera = await consultar(''), ultima = await consultar('&pagina=12');
    expect(primera.response.status).toBe(200); expect(primera.data.total).toBe(115); expect(primera.data.porPagina).toBe(10); expect(primera.data.datos).toHaveLength(10);
    expect(ultima.data.datos).toHaveLength(5); expect(ultima.data.datos[4].clave).toBe(prefijo + '114');
    const especifica = await ctx.api(`/academico/materias/listado?buscar=${prefijo}114`, { token });
    expect(especifica.data.total).toBe(1); expect(especifica.data.datos[0].clave).toBe(prefijo + '114');
    const literal = await repo.save({ clave: `${prefijo}L`, nombre: `Literal %_! ${ctx.sufijo}`, creditos: 0, activo: true });
    const busqueda = await ctx.api(`/academico/materias/listado?buscar=${encodeURIComponent('%_!')}`, { token });
    expect(busqueda.data.datos.map((m: { id: number }) => m.id)).toEqual([literal.id]);
    for (const query of ['pagina=0', 'porPagina=101', 'buscar=' + 'a'.repeat(121)]) expect((await ctx.api('/academico/materias/listado?' + query, { token })).response.status).toBe(400);
    const arreglo = await ctx.api('/academico/materias', { token });
    expect(Array.isArray(arreglo.data)).toBe(true); expect(arreglo.data.some((m: { id: number }) => m.id === literal.id)).toBe(true);
    const alumno = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.alumnoUsuarioId })).email);
    expect((await ctx.api('/academico/materias/listado', { token: alumno })).response.status).toBe(403);
  });
  it('consultas de ciclos y planteles: diez reales, búsqueda literal, alcance y detalle por ID', async () => {
    const emitir = async (id:number) => ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({id})).email);
    const token = await emitir(ctx.superadminId), admin = await emitir(ctx.adminId), alumno = await emitir(ctx.alumnoUsuarioId);
    const prefijo = `UX${ctx.sufijo}`;
    const ciclos = await ctx.dataSource.getRepository(CicloEscolar).save(Array.from({length:12},(_,i)=>({clave:`${prefijo}${i}`,nombre:`${prefijo} ciclo ${i}`,fechaInicio:'2056-01-01',fechaFin:'2056-12-31',activo:false,estado:'PREPARACION' as const})));
    const planteles = await ctx.dataSource.getRepository(Plantel).save(Array.from({length:12},(_,i)=>({clave:`U${ctx.sufijo}${i}`,nombre:`${prefijo} sede ${i}`,activo:true})));
    for(const ruta of ['/academico/ciclos/listado','/planteles/listado']) {
      const primera = await ctx.api(`${ruta}?buscar=${prefijo}`,{token});
      const segunda = await ctx.api(`${ruta}?buscar=${prefijo}&pagina=2`,{token});
      expect(primera.response.status).toBe(200);expect(primera.data.total).toBe(12);expect(primera.data.datos).toHaveLength(10);expect(segunda.data.datos).toHaveLength(2);
      expect(new Set([...primera.data.datos,...segunda.data.datos].map((r:{id:number})=>r.id)).size).toBe(12);
      for(const query of ['pagina=0','porPagina=101']) expect((await ctx.api(ruta+'?'+query,{token})).response.status).toBe(400);
      expect((await ctx.api(ruta,{token:alumno})).response.status).toBe(403);
    }
    expect((await ctx.api(`/planteles/listado?buscar=${prefijo}`,{token:admin})).data.total).toBe(0);
    expect((await ctx.api('/planteles/'+planteles[0].id,{token:admin})).response.status).toBe(403);
    expect((await ctx.api('/planteles/'+planteles[0].id,{token})).data.nombre).toBe(planteles[0].nombre);
    expect((await ctx.api('/academico/ciclos/'+ciclos[0].id,{token})).data.clave).toBe(ciclos[0].clave);
    const grupo = await ctx.dataSource.getRepository(GrupoMateria).findOneByOrFail({id:ctx.grupoMateriaIdMaestro});
    expect((await ctx.api('/academico/grupos/'+grupo.grupoId,{token:admin})).response.status).toBe(200);
    expect((await ctx.api('/academico/grupos/'+grupo.grupoId,{token:alumno})).response.status).toBe(403);
    const literal = await ctx.dataSource.getRepository(CicloEscolar).save({clave:prefijo+'L',nombre:prefijo+' %_! literal',fechaInicio:'2056-01-01',fechaFin:'2056-12-31',activo:false,estado:'PREPARACION'});
    expect((await ctx.api('/academico/ciclos/listado?buscar='+encodeURIComponent('%_!'),{token})).data.datos.map((r:{id:number})=>r.id)).toEqual([literal.id]);
  });

}
