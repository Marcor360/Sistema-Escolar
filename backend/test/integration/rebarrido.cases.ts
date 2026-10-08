import { expect, it, jest } from '@jest/globals';
import { ContextoIntegracion } from './contexto';
import { Actividad, Alumno, Calificacion, ConceptoPago, Entrega, GrupoMateria, HistorialCalificacion, OrdenPago, Pago, Usuario } from '../../src/entities';
import { ActividadesService } from '../../src/actividades/actividades.service';
import { OpenpayService, OpenpayCharge } from '../../src/finanzas/openpay.service';
import { JwtService } from '@nestjs/jwt';
import { JwtUser } from '../../src/common/current-user.decorator';
export function registrarRebarrido(ctx: ContextoIntegracion) {
  const root = async () => ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.superadminId })).email);
  it('logout invalida el archivo firmado de esa sesión; otra sesión funciona hasta revocar su versión', async () => {
    const token = await root(), otra = await root();
    const form = new FormData(); form.append('titulo','Archivo sesión'); form.append('archivo',new Blob(['contenido de sesión']),'sesion.txt');
    const material = await ctx.api(`/grupo-materias/${ctx.grupoMateriaIdMaestro}/materiales`,{ method: 'POST',token,body: form }); expect(material.response.status).toBe(201);
    const ruta = `/archivos/materiales/${material.data.id}/enlace`;
    const url1 = (await ctx.api(ruta,{ token })).data.url, url2 = (await ctx.api(ruta,{ token: otra })).data.url;
    const descargar = (url: string) => fetch(new URL(url,ctx.baseUrl));
    expect((await descargar(url1)).status).toBe(200);
    expect((await ctx.api('/auth/logout',{ method: 'POST',token })).response.status).toBe(201);
    expect((await descargar(url1)).status).toBe(401); expect((await descargar(url2)).status).toBe(200);
    await ctx.dataSource.getRepository(Usuario).increment({ id: ctx.superadminId },'sessionVersion',1);
    expect((await descargar(url2)).status).toBe(401);
    expect((await ctx.api(`/materiales/${material.data.id}`,{ method: 'DELETE',token: await root() })).response.status).toBe(200);
  });
  it('PATCH limpia campos opcionales con null y devuelve los nombres actualizados del expediente', async () => {
    const token = await root();
    expect((await ctx.api('/calendario?hasta=1970-01-01T00:00:00Z',{ token })).response.status).toBe(400);
    expect((await ctx.api('/calendario',{ method: 'POST',token,body: { titulo: '  ',fechaInicio: '2027-01-01T12:00:00Z' } })).response.status).toBe(400);
    for (const password of ['x'.repeat(73),'á'.repeat(37),'\ud800'.repeat(8)]) expect((await ctx.api('/usuarios',{ method: 'POST',token,body: { email: `rlarga_${ctx.sufijo}@example.invalid`,nombre: 'Password',apellidoPaterno: 'Límite',password,roles: ['FINANZAS'],plantelIds: [ctx.plantelId] } })).response.status).toBe(400);
    const alta = await ctx.api('/alumnos',{ method: 'POST',token,body: { email: `rn_${ctx.sufijo}@example.invalid`,password: 'Integracion_Segura_42!',nombre: 'Antes',apellidoPaterno: 'Alumno',apellidoMaterno: 'Materno',telefono: '55555',matricula: `RN${ctx.sufijo}`,plantelId: ctx.plantelId,curp: 'CURP',tutorNombre: 'Tutor',tutorTelefono: '55555',direccion: 'Dirección' } }); expect(alta.response.status).toBe(201);
    const patch = await ctx.api(`/alumnos/${alta.data.id}`,{ method: 'PATCH',token,body: { nombre: 'Después',apellidoMaterno: null,telefono: null,curp: null,tutorNombre: null,tutorTelefono: null,direccion: null } }); expect(patch.response.status).toBe(200);
    expect(patch.data.usuario).toMatchObject({ nombre: 'Después',apellidoMaterno: null,telefono: null }); expect(patch.data).toMatchObject({ curp: null,tutorNombre: null,tutorTelefono: null,direccion: null });
    const alumno = await ctx.dataSource.getRepository(Alumno).findOneByOrFail({ id: alta.data.id }); expect(alumno.usuario.nombre).toBe('Después');
    const docente = await ctx.api('/docentes',{ method: 'POST',token,body: { email: `rnd_${ctx.sufijo}@example.invalid`,password: 'Integracion_Segura_42!',nombre: 'Antes',apellidoPaterno: 'Docente',numEmpleado: `RD${ctx.sufijo}`,plantelIds: [ctx.plantelId],cedulaProfesional: '123',especialidad: 'Matemáticas' } }); expect(docente.response.status).toBe(201);
    const editar = await ctx.api(`/docentes/${docente.data.id}`,{ method: 'PATCH',token,body: { nombre: 'Después',cedulaProfesional: null,especialidad: null } }); expect(editar.response.status).toBe(200); expect(editar.data.usuario.nombre).toBe('Después'); expect(editar.data).toMatchObject({ cedulaProfesional: null,especialidad: null });
    const omitir = await ctx.api(`/docentes/${docente.data.id}`,{ method: 'PATCH',token,body: { apellidoPaterno: 'Corregido' } }); expect(omitir.data.usuario.nombre).toBe('Después');
  });
  it('observaciones y comentarios nullable se limpian; la nota oficial conserva motivo e historial', async () => {
    const token = await root();
    const alumno = await ctx.api('/alumnos',{ method: 'POST',token,body: { email: `rnota_${ctx.sufijo}@example.invalid`,password: 'Integracion_Segura_42!',nombre: 'Nota',apellidoPaterno: 'Limpieza',matricula: `RT${ctx.sufijo}`,plantelId: ctx.plantelId } }); expect(alumno.response.status).toBe(201);
    const gm = await ctx.dataSource.getRepository(GrupoMateria).findOneByOrFail({ id: ctx.grupoMateriaIdMaestro });
    expect((await ctx.api(`/academico/grupos/${gm.grupoId}/alumnos`,{ method: 'POST',token,body: { alumnoId: alumno.data.id } })).response.status).toBe(201);
    const body = { grupoMateriaId: gm.id,parcial: 3,items: [{ alumnoId: alumno.data.id,calificacion: 85,observaciones: 'Texto anterior' }] };
    expect((await ctx.api(`/calificaciones/periodos/${gm.id}/3`,{ method: 'PATCH',token,body: { estatus: 'ABIERTO' } })).response.status).toBe(200);
    expect((await ctx.api('/calificaciones/captura',{ method: 'POST',token,body })).response.status).toBe(201);
    const limpio = { ...body,items: [{ ...body.items[0],observaciones: null }] };
    expect((await ctx.api('/calificaciones/captura',{ method: 'POST',token,body: limpio })).response.status).toBe(400);
    expect((await ctx.api('/calificaciones/captura',{ method: 'POST',token,body: { ...limpio,motivo: 'Retirar observación incorrecta' } })).data.capturadas).toBe(1);
    expect((await ctx.dataSource.getRepository(Calificacion).findOneByOrFail({ alumnoId: alumno.data.id,grupoMateriaId: gm.id,parcial: 3 })).observaciones).toBeNull();
    expect(await ctx.dataSource.getRepository(HistorialCalificacion).countBy({ alumnoId: alumno.data.id,grupoMateriaId: gm.id,parcial: 3 })).toBe(2);
    expect(await ctx.dataSource.getRepository(HistorialCalificacion).findOneBy({ alumnoId: alumno.data.id,motivo: 'Retirar observación incorrecta' })).toMatchObject({ observacionAnterior: 'Texto anterior',observacionNueva: null,valorAnterior: 85,valorNuevo: 85 });
    const actividad = await ctx.api('/actividades',{ method: 'POST',token,body: { grupoMateriaId: gm.id,titulo: 'Actividad nullable',descripcion: 'Texto previo' } }); expect(actividad.response.status).toBe(201);
    expect((await ctx.api(`/actividades/${actividad.data.id}`,{ method: 'PATCH',token,body: { descripcion: null } })).data.descripcion).toBeNull();
    const estudiantil = await ctx.emitirToken(`rnota_${ctx.sufijo}@example.invalid`);
    const entrega = await ctx.api(`/actividades/${actividad.data.id}/entrega`,{ method: 'POST',token: estudiantil,body: { comentario: 'Anterior' } }); expect(entrega.response.status).toBe(201);
    expect((await ctx.api(`/actividades/${actividad.data.id}/entrega`,{ method: 'POST',token: estudiantil,body: { comentario: null } })).data.comentarioAlumno).toBeNull();
    const calificar = `/entregas/${entrega.data.id}/calificar`;
    expect((await ctx.api(calificar,{ method: 'PATCH',token,body: { calificacion: 9.999 } })).response.status).toBe(400);
    expect((await ctx.api(calificar,{ method: 'PATCH',token,body: { calificacion: 90,comentario: 'Docente' } })).response.status).toBe(200);
    expect((await ctx.api(calificar,{ method: 'PATCH',token,body: { calificacion: 90,comentario: null } })).data.comentarioDocente).toBeNull();
    expect((await ctx.dataSource.getRepository(Entrega).findOneByOrFail({ id: entrega.data.id })).calificacion).toBe(90);
    expect((await ctx.api(`/alumnos/${alumno.data.id}/baja`,{ method: 'POST',token })).response.status).toBe(201);
  });
  it('editar mientras se desactiva una actividad nunca vuelve a activarla', async () => {
    const token = await root(), actor = ctx.app.get(JwtService).verify<JwtUser>(token), servicio = ctx.app.get(ActividadesService);
    for (let i = 0; i < 3; i++) {
      const alta = await ctx.api('/actividades',{ method: 'POST',token,body: { grupoMateriaId: ctx.grupoMateriaIdMaestro,titulo: `Carrera ${i}` } }); expect(alta.response.status).toBe(201);
      await Promise.all([servicio.actualizar(alta.data.id,{ titulo: `Corrección ${i}` },actor),servicio.desactivar(alta.data.id,actor)]);
      expect((await ctx.dataSource.getRepository(Actividad).findOneByOrFail({ id: alta.data.id })).activo).toBe(false);
    }
  });
  const cargoNuevo = async (token: string) => {
    const concepto = await ctx.dataSource.getRepository(ConceptoPago).findOneByOrFail({ clave: `CW${ctx.sufijo}` });
    const cargo = await ctx.api('/finanzas/cargos',{ method: 'POST',token,body: { alumnoId: ctx.alumnoId,conceptoId: concepto.id,descripcion: 'Orden de regresión',monto: 25 } }); expect(cargo.response.status).toBe(201); return cargo.data.id as number;
  };
  it('recuperar una orden ambigua ya pagada aplica una vez y el webhook repetido no duplica', async () => {
    const token = await root(), cargoId = await cargoNuevo(token), provider = ctx.app.get(OpenpayService);
    const orden = await ctx.dataSource.getRepository(OrdenPago).save({ cargoId,alumnoId: ctx.alumnoId,plantelId: ctx.plantelId,monto: 25,descripcion: 'Ambigua',estatus: 'CREADA' });
    const charge: OpenpayCharge = { id: `recover${ctx.sufijo}`,order_id: `ORD-${orden.id}`,amount: 25,currency: 'MXN',transaction_type: 'charge',status: 'completed' };
    const consulta = jest.spyOn(provider,'buscarCargoPorOrden').mockResolvedValue(charge);
    try {
      const respuesta = await ctx.api('/finanzas/ordenes',{ method: 'POST',token,body: { cargoId } }); expect(respuesta.response.status).toBe(201); expect(respuesta.data.estatus).toBe('COMPLETADA');
      expect(await ctx.dataSource.getRepository(Pago).countBy({ ordenPagoId: orden.id })).toBe(1);
      expect((await ctx.api('/finanzas/webhook/openpay',{ method: 'POST',body: { type: 'charge.succeeded',transaction: charge } })).response.status).toBe(200);
      expect(await ctx.dataSource.getRepository(Pago).countBy({ ordenPagoId: orden.id })).toBe(1);
    } finally { consulta.mockRestore(); }
  });
  it('un rechazo tardío del POST del proveedor no sobrescribe la orden completada por webhook', async () => {
    const token = await root(), cargoId = await cargoNuevo(token), provider = ctx.app.get(OpenpayService);
    const crear = jest.spyOn(provider,'crearCargoRedirect').mockImplementation(async (datos) => {
      const charge: OpenpayCharge = { id: `race${ctx.sufijo}`,order_id: datos.ordenId,amount: 25,currency: 'MXN',transaction_type: 'charge',status: 'completed' };
      expect((await ctx.api('/finanzas/webhook/openpay',{ method: 'POST',body: { type: 'charge.succeeded',transaction: charge } })).response.status).toBe(200);
      throw Object.assign(new Error('Rechazo HTTP tardío'),{ response: { status: 400 } });
    });
    try {
      const respuesta = await ctx.api('/finanzas/ordenes',{ method: 'POST',token,body: { cargoId } });
      expect(respuesta.response.status).toBe(201); expect(respuesta.data.estatus).toBe('COMPLETADA');
      const orden = await ctx.dataSource.getRepository(OrdenPago).findOneByOrFail({ cargoId }); expect(orden.estatus).toBe('COMPLETADA'); expect(await ctx.dataSource.getRepository(Pago).countBy({ ordenPagoId: orden.id })).toBe(1);
    } finally { crear.mockRestore(); }
  });
}
