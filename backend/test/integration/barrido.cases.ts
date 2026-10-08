import { inflateSync } from 'zlib';
import { ArchivoLimpieza, Inscripcion } from '../../src/entities';
import { ContextoIntegracion } from './contexto';
import { expect,it } from '@jest/globals';
import { AuthService } from '../../src/auth/auth.service';
import { UsuariosService } from '../../src/usuarios/usuarios.service';
import { Usuario, OrdenPago, Alumno, GrupoMateria } from '../../src/entities';
export function registrarBarrido(ctx: ContextoIntegracion) {
  it('edición de marca y carga concurrente preservan el logo; la sustitución conserva su limpieza',async () => {
    const root = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.superadminId })).email);
    const { data: original } = await ctx.api('/configuracion/marca');
    const body = { nombreInstitucion: 'Marca Concurrente',nombreCorto: original.nombreCorto,colorPrimario: original.colorPrimario,colorAcento: original.colorAcento };
    const subir = () => {
      const form = new FormData();
      form.append('logo',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64')],{ type: 'image/png' }),'logo.png');
      return ctx.api('/configuracion/marca/logo',{ method: 'POST',token: root,body: form });
    };
    try {
      const [edicion,carga] = await Promise.all([ctx.api('/configuracion/marca',{ method: 'PUT',token: root,body }),subir()]);
      expect(edicion.response.status).toBe(200); expect(carga.response.status).toBe(201);
      expect((await ctx.api('/configuracion/marca')).data).toMatchObject({ nombreInstitucion: body.nombreInstitucion,logoUrl: carga.data.logoUrl });
      const reemplazo = await subir(); expect(reemplazo.response.status).toBe(201); expect(reemplazo.data.logoUrl).not.toBe(carga.data.logoUrl);
      expect(await ctx.dataSource.getRepository(ArchivoLimpieza).existsBy({ nombre: carga.data.logoUrl.slice('/uploads/'.length) })).toBe(true);
      expect((await ctx.api('/configuracion/marca')).data.logoUrl).toBe(reemplazo.data.logoUrl);
      expect((await ctx.api('/configuracion/marca/logo',{ method: 'DELETE',token: root })).response.status).toBe(200);
      expect(await ctx.dataSource.getRepository(ArchivoLimpieza).existsBy({ nombre: reemplazo.data.logoUrl.slice('/uploads/'.length) })).toBe(true);
    } finally {
      await ctx.api('/configuracion/marca/logo',{ method: 'DELETE',token: root });
      await ctx.api('/configuracion/marca',{ method: 'PUT',token: root,body: { ...body,nombreInstitucion: original.nombreInstitucion } });
    }
  });

  it('la boleta usa la misma identidad institucional configurable que web y móvil',async () => {
    const root = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.superadminId })).email);
    const { data: original } = await ctx.api('/configuracion/marca');
    const nombreInstitucion = 'Colegio Institucional General';
    try {
      expect((await ctx.api('/configuracion/marca',{ method: 'PUT',token: root,body: { nombreInstitucion,nombreCorto: original.nombreCorto,colorPrimario: original.colorPrimario,colorAcento: original.colorAcento } })).response.status).toBe(200);
      expect((await ctx.api('/configuracion/marca')).data.nombreInstitucion).toBe(nombreInstitucion);
      const clase = await ctx.dataSource.getRepository(GrupoMateria).findOneByOrFail({ id: ctx.grupoMateriaIdMaestro });
      const inscripcion = await ctx.dataSource.getRepository(Inscripcion).findOneByOrFail({ alumnoId: ctx.alumnoId,grupoId: clase.grupoId });
      const response = await fetch(`${ctx.baseUrl}/reportes/boleta/${ctx.alumnoId}?cicloId=${clase.grupo.cicloId}&inscripcionId=${inscripcion.id}`,{ headers: { authorization: `Bearer ${root}` } }); expect(response.status).toBe(200);
      const documento = Buffer.from(await response.arrayBuffer()).toString('latin1');
      const textos = [...documento.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)].flatMap((m) => {
        const contenido = inflateSync(Buffer.from(m[1],'latin1')).toString('latin1');
        return [...contenido.matchAll(/<([0-9a-f]+)>/gi)].map((h) => Buffer.from(h[1],'hex').toString('latin1'));
      }).join('');
      expect(textos).toContain(nombreInstitucion);
    } finally { await ctx.api('/configuracion/marca',{ method: 'PUT',token: root,body: { nombreInstitucion: original.nombreInstitucion,nombreCorto: original.nombreCorto,colorPrimario: original.colorPrimario,colorAcento: original.colorAcento } }); }
  });

  it('contratos rechazan null, fechas con hora y valores que exceden las columnas antes de escribir',async () => {
    const root = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.superadminId })).email);
    const clase = await ctx.dataSource.getRepository(GrupoMateria).findOneByOrFail({ id: ctx.grupoMateriaIdMaestro });
    const pruebas: [string,string,unknown][] = [
      ['PATCH',`/academico/materias/${clase.materiaId}`,{ nombre: null }],
      ['PATCH',`/academico/materias/${clase.materiaId}`,{ creditos: null }],
      ['POST','/academico/ciclos',{ clave: `GDATE${ctx.sufijo}`,nombre: 'Civil',fechaInicio: '2027-01-01T00:00:00Z',fechaFin: '2027-12-31' }],
      ['POST','/finanzas/conceptos',{ clave: 'X'.repeat(21),nombre: 'Largo',tipo: 'OTRO',montoBase: 10 }],
      ['POST','/finanzas/conceptos',{ clave: `GP${ctx.sufijo}`,nombre: 'Precisión',tipo: 'OTRO',montoBase: 1.234 }],
    ];
    for (const [method,ruta,body] of pruebas) expect((await ctx.api(ruta,{ method,token: root,body })).response.status).toBe(400);
  });
  it('PATCH vacío, materia inexistente y claves duplicadas tienen errores de dominio, sin error 500',async () => {
    const root = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.superadminId })).email);
    const clase = await ctx.dataSource.getRepository(GrupoMateria).findOneByOrFail({ id: ctx.grupoMateriaIdMaestro });
    for (const ruta of [`/academico/materias/${clase.materiaId}`,`/academico/grupos/${clase.grupoId}`,`/academico/ciclos/${clase.grupo.cicloId}`]) expect((await ctx.api(ruta,{ method: 'PATCH',token: root,body: {} })).response.status).toBe(400);
    expect((await ctx.api('/academico/materias/2147483647',{ method: 'PATCH',token: root,body: { nombre: 'Inexistente' } })).response.status).toBe(404);
    expect((await ctx.api('/academico/materias',{ method: 'POST',token: root,body: { clave: clase.materia.clave,nombre: 'Duplicada' } })).response.status).toBe(409);
    const concepto = await ctx.api('/finanzas/conceptos',{ method: 'POST',token: root,body: { clave: `GCO${ctx.sufijo}`,nombre: 'General',tipo: 'OTRO',montoBase: 10 } }); expect(concepto.response.status).toBe(201);
    expect((await ctx.api('/finanzas/conceptos',{ method: 'POST',token: root,body: { clave: `GCO${ctx.sufijo}`,nombre: 'General',tipo: 'OTRO',montoBase: 10 } })).response.status).toBe(409);
    expect((await ctx.api(`/finanzas/conceptos/${concepto.data.id}`,{ method: 'PATCH',token: root,body: {} })).response.status).toBe(400);
  });
  it('difusión rechaza destinatarios inválidos y mensajes que exceden el almacenamiento',async () => {
    const root = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.superadminId })).email);
    for (const body of [{ titulo: 'Prueba',mensaje: 'Texto',usuarioIds: ['no-es-id'] },{ titulo: 'X'.repeat(151),mensaje: 'Texto',rol: 'ALUMNO' },{ titulo: 'Prueba',mensaje: 'X'.repeat(601),rol: 'ALUMNO' }]) expect((await ctx.api('/notificaciones/difundir',{ method: 'POST',token: root,body })).response.status).toBe(400);
  });

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
