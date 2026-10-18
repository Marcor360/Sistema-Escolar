import { expect, it } from '@jest/globals';
import { ContextoIntegracion } from './contexto';
import { Materia, Usuario } from '../../src/entities';
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
}
