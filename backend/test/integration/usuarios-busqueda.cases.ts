import { expect, it } from '@jest/globals';
import { Alumno, Docente, Usuario } from '../../src/entities';
import { ContextoIntegracion } from './contexto';

export function registrarBusquedaUsuarios(ctx: ContextoIntegracion) {
  it('busca segundo apellido en los tres directorios, con paginación y alcance real', async () => {
    const usuarios = ctx.dataSource.getRepository(Usuario);
    const docente = await ctx.dataSource.getRepository(Docente).findOneByOrFail({ id: ctx.docenteFueraDeAlcanceId });
    const alumno = await ctx.dataSource.getRepository(Alumno).findOneByOrFail({ id: ctx.alumnoId });
    const originales = await Promise.all([alumno.usuarioId, docente.usuarioId, ctx.adminId].map((id) => usuarios.findOneByOrFail({ id })));
    const apellido = `Materno${ctx.sufijo}`;
    const root = await ctx.emitirToken((await usuarios.findOneByOrFail({ id: ctx.superadminId })).email);
    try {
      for (const u of originales) await usuarios.update(u.id, { apellidoMaterno: apellido });
      for (const [tipo, id] of [['ALUMNO', alumno.id], ['DOCENTE', docente.id], ['ADMINISTRATIVO', ctx.adminId]] as const) {
        const ruta = `/usuarios/listado?tipo=${tipo}&buscar=${encodeURIComponent(`  ${apellido}  `)}`;
        const { response, data } = await ctx.api(ruta, { token: root });
        expect(response.status).toBe(200);
        expect(data).toMatchObject({ pagina: 1, porPagina: 10, total: 1 });
        expect(data.datos.map((fila: { id: number }) => fila.id)).toEqual([id]);
        const segunda = await ctx.api(`${ruta}&pagina=2&porPagina=1`, { token: root });
        expect(segunda.data).toMatchObject({ pagina: 2, porPagina: 1, total: 1, datos: [] });
      }
      const finanzasB = await ctx.emitirFinanzasB();
      const scoped = await ctx.api(`/usuarios/listado?tipo=ALUMNO&buscar=${apellido}`, { token: finanzasB });
      expect(scoped.response.status).toBe(200);
      expect(scoped.data.datos.some((fila: { id: number }) => fila.id === alumno.id)).toBe(alumno.plantelId === ctx.otroPlantelId);
      const inyeccion = await ctx.api(`/usuarios/listado?tipo=ALUMNO&buscar=${encodeURIComponent("' OR 1=1 --")}`, { token: root });
      expect(inyeccion.response.status).toBe(200);
      expect(inyeccion.data).toMatchObject({ total: 0, datos: [] });
    } finally {
      for (const u of originales) await usuarios.update(u.id, { apellidoMaterno: u.apellidoMaterno });
    }
  });
}
