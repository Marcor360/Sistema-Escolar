import { ContextoIntegracion } from './contexto';
import { expect,it } from '@jest/globals';
import { AuthService } from '../../src/auth/auth.service';
import { UsuariosService } from '../../src/usuarios/usuarios.service';
import { Usuario, OrdenPago, Alumno, GrupoMateria } from '../../src/entities';
export function registrarBarrido(ctx: ContextoIntegracion) {
  it('el filtro de plantel de conducta se respeta para docentes con clases en dos planteles',async () => {
    const root = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.superadminId })).email);
    const post = (ruta: string,body: unknown,token = root) => ctx.api(ruta,{ method: 'POST',token,body });
    const docente = await post('/docentes',{ email: `barridocon_${ctx.sufijo}@example.invalid`,nombre: 'Docente',apellidoPaterno: 'Dos planteles',numEmpleado: `BCON${ctx.sufijo}`,password: 'Integracion_Segura_42!',plantelIds: [ctx.plantelId,ctx.otroPlantelId] }); expect(docente.response.status).toBe(201);
    const clase = await ctx.dataSource.getRepository(GrupoMateria).findOneByOrFail({ id: ctx.grupoMateriaIdMaestro });
    const maestro = await ctx.emitirToken(`barridocon_${ctx.sufijo}@example.invalid`), ids: number[] = [];
    for (const [pos,plantelId] of [ctx.plantelId,ctx.otroPlantelId].entries()) {
      const alumno = await post('/alumnos',{ email: `barridoconal${pos}_${ctx.sufijo}@example.invalid`,nombre: 'Alumno',apellidoPaterno: 'Conducta',matricula: `BC${pos}${ctx.sufijo}`,password: 'Integracion_Segura_42!',plantelId }); expect(alumno.response.status).toBe(201);
      const grupo = await post('/academico/grupos',{ nombre: `Conducta${pos}-${ctx.sufijo}`,cicloId: clase.grupo.cicloId,plantelId }); expect(grupo.response.status).toBe(201);
      expect((await post(`/academico/grupos/${grupo.data.id}/materias`,{ materiaId: clase.materiaId,docenteId: docente.data.id })).response.status).toBe(201);
      expect((await post(`/academico/grupos/${grupo.data.id}/alumnos`,{ alumnoId: alumno.data.id })).response.status).toBe(201);
      const incidencia = await post('/conducta/incidencias',{ alumnoId: alumno.data.id,grupoId: grupo.data.id,tipo: 'CONVIVENCIA',gravedad: 'LEVE',descripcion: 'Seguimiento interno de barrido',fecha: new Date().toISOString() },maestro); expect(incidencia.response.status).toBe(201); ids.push(incidencia.data.id);
    }
    const a = await ctx.api(`/conducta/incidencias?plantelId=${ctx.plantelId}`,{ token: maestro }); expect(a.response.status).toBe(200); expect(a.data.datos.map((i: { id: number }) => i.id)).toEqual([ids[0]]);
    const b = await ctx.api(`/conducta/incidencias?plantelId=${ctx.otroPlantelId}`,{ token: maestro }); expect(b.data.datos.map((i: { id: number }) => i.id)).toEqual([ids[1]]);
  });

  it('adeudos y órdenes de conciliación paginan sin errores y mantienen alcance',async () => {
    const root = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.superadminId })).email);
    const alumno = await ctx.dataSource.getRepository(Alumno).findOneByOrFail({ id: ctx.alumnoId });
    const orden = await ctx.dataSource.getRepository(OrdenPago).save({ alumnoId: alumno.id,plantelId: ctx.plantelId,monto: 10,descripcion: 'Incidencia de barrido',estatus: 'CREADA' });
    for (const ruta of ['/finanzas/adeudos?porPagina=1','/finanzas/conciliacion/ordenes']) {
      const r = await ctx.api(ruta,{ token: root }); expect(r.response.status).toBe(200); expect(r.data).toHaveProperty('datos'); expect(r.data.total).toBeGreaterThan(0);
    }
    const ordenes = await ctx.api('/finanzas/conciliacion/ordenes',{ token: root }); expect(ordenes.data.datos).toEqual(expect.arrayContaining([expect.objectContaining({ id: orden.id })]));
    const otro = await ctx.emitirFinanzasB();
    const restringidas = await ctx.api('/finanzas/conciliacion/ordenes',{ token: otro }); expect(restringidas.response.status).toBe(200); expect(restringidas.data.datos.some((o: { id: number }) => o.id === orden.id)).toBe(false);
  });
  it('cambios simultáneos de contraseña no pierden la versión de revocación',async () => {
    const root = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.superadminId })).email);
    const alta = await ctx.api('/usuarios',{ method: 'POST',token: root,body: { email: `barridoauth_${ctx.sufijo}@example.invalid`,nombre: 'Carrera',apellidoPaterno: 'Sesión',password: 'Integracion_Segura_42!',roles: ['FINANZAS'],plantelIds: [ctx.plantelId] } }); expect(alta.response.status).toBe(201);
    const auth = ctx.app.get(AuthService);
    await Promise.all([auth.cambiarPassword(alta.data.id,'Integracion_Segura_42!','Nueva_Carrera_Uno_42!'),auth.cambiarPassword(alta.data.id,'Integracion_Segura_42!','Nueva_Carrera_Dos_42!')]);
    expect((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: alta.data.id })).sessionVersion).toBe(2);
  });
  it('editar contraseña mientras se da de baja no reactiva el usuario',async () => {
    const root = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.superadminId })).email);
    const alta = await ctx.api('/usuarios',{ method: 'POST',token: root,body: { email: `barridobaja_${ctx.sufijo}@example.invalid`,nombre: 'Carrera',apellidoPaterno: 'Baja',password: 'Integracion_Segura_42!',roles: ['FINANZAS'],plantelIds: [ctx.plantelId] } }); expect(alta.response.status).toBe(201);
    const usuarios = ctx.app.get(UsuariosService);
    await Promise.all([usuarios.actualizar(alta.data.id,{ password: 'Nueva_Carrera_42!',nombre: 'Corregido' }),usuarios.desactivar(alta.data.id)]);
    expect((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: alta.data.id })).activo).toBe(false);
  });
}
