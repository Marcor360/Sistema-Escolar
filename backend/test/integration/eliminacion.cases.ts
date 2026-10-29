import { curpFicticia } from './identidad-ficticia';
import { BitacoraFinanciera } from '../../src/entities/bitacora-financiera.entity';
import { PushDispositivo, PushEnvio } from '../../src/entities';
import { randomUUID } from 'crypto';
import { expect, it } from '@jest/globals';
import { Alumno, Docente, Plantel, Usuario, UsuarioPlantel, Notificacion, Sesion } from '../../src/entities';
import { ContextoIntegracion } from './contexto';

export function registrarEliminacion(ctx: ContextoIntegracion) {
  it('elimina alumno, docente y personal sin historial junto con cuentas, roles y sesiones en ambos motores', async () => {
    const root = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.superadminId })).email);
    const personal = await ctx.api('/usuarios', { method: 'POST', token: root, body: {
      email: `del_staff_${ctx.sufijo}@example.invalid`, password: 'Integracion_Segura_42!',
      nombre: 'Eliminar', apellidoPaterno: 'Personal', roles: ['ADMINISTRATIVO'], plantelIds: [ctx.plantelId],
    } });
    expect(personal.response.status).toBe(201);
    const sesion = await ctx.emitirToken(personal.data.email);
    await ctx.dataSource.getRepository(Notificacion).save({ usuarioId: personal.data.id, titulo: 'Prueba', mensaje: 'Prueba' });
    const borrar = (ruta: string) => ctx.api(ruta, { method: 'DELETE', token: root, body: { confirmacion: 'ELIMINAR' } });
    expect((await borrar(`/usuarios/${personal.data.id}/permanente`)).response.status).toBe(200);
    expect(await ctx.dataSource.getRepository(Usuario).findOne({ where: { id: personal.data.id }, withDeleted: true })).toBeNull();
    expect(await ctx.dataSource.getRepository(Sesion).countBy({ usuarioId: personal.data.id })).toBe(0);
    expect(await ctx.dataSource.getRepository(UsuarioPlantel).countBy({ usuarioId: personal.data.id })).toBe(0);
    expect((await ctx.api('/auth/me', { token: sesion })).response.status).toBe(401);

    const alumno = await ctx.api('/alumnos', { method: 'POST', token: root, body: {
      email: `del_al_${ctx.sufijo}@example.invalid`, nombre: 'Eliminar', apellidoPaterno: 'Alumno',
      matricula: `DEL${ctx.sufijo}`, plantelId: ctx.plantelId, curp: curpFicticia(),
    } });
    expect(alumno.response.status).toBe(201);
    expect((await borrar(`/alumnos/${alumno.data.id}/permanente`)).response.status).toBe(200);
    expect(await ctx.dataSource.getRepository(Alumno).findOne({ where: { id: alumno.data.id }, withDeleted: true })).toBeNull();
    expect(await ctx.dataSource.getRepository(Usuario).findOne({ where: { id: alumno.data.usuarioId }, withDeleted: true })).toBeNull();

    const docente = await ctx.api('/docentes', { method: 'POST', token: root, body: {
      email: `del_doc_${ctx.sufijo}@example.invalid`, password: 'Integracion_Segura_42!',
      nombre: 'Eliminar', apellidoPaterno: 'Docente', cedulaPendiente: true, numEmpleado: `DEL${ctx.sufijo}`, plantelIds: [ctx.plantelId],
    } });
    expect(docente.response.status).toBe(201);
    const perfil = await ctx.dataSource.getRepository(Docente).findOneByOrFail({ id: docente.data.id });
    expect((await borrar(`/docentes/${docente.data.id}/permanente`)).response.status).toBe(200);
    expect(await ctx.dataSource.getRepository(Docente).findOne({ where: { id: perfil.id }, withDeleted: true })).toBeNull();
    expect(await ctx.dataSource.getRepository(Usuario).findOne({ where: { id: perfil.usuarioId }, withDeleted: true })).toBeNull();

    const plantel = await ctx.api('/planteles', { method: 'POST', token: root, body: { clave: `D${ctx.sufijo.slice(-8).toUpperCase()}`, nombre: 'Plantel sin registros' } });
    expect(plantel.response.status).toBe(201);
    expect((await borrar(`/planteles/${plantel.data.id}/permanente`)).response.status).toBe(200);
    expect(await ctx.dataSource.getRepository(Plantel).findOneBy({ id: plantel.data.id })).toBeNull();
  });

  it('rechaza roles locales, falta de confirmación, cuenta propia y eliminación de expedientes con historial', async () => {
    const root = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.superadminId })).email);
    const admin = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.adminId })).email);
    const ruta = `/alumnos/${ctx.alumnoId}/permanente`;
    expect((await ctx.api(ruta, { method: 'DELETE', token: admin, body: { confirmacion: 'ELIMINAR' } })).response.status).toBe(403);
    expect((await ctx.api(ruta, { method: 'DELETE', token: root, body: {} })).response.status).toBe(400);
    expect((await ctx.api(ruta, { method: 'DELETE', token: root, body: { confirmacion: 'ELIMINAR' } })).response.status).toBe(409);
    expect(await ctx.dataSource.getRepository(Alumno).findOneBy({ id: ctx.alumnoId })).not.toBeNull();
    expect(await ctx.dataSource.getRepository(Usuario).findOneBy({ id: ctx.alumnoUsuarioId })).not.toBeNull();
    for (const rutaBloqueada of [`/planteles/${ctx.plantelId}/permanente`, `/usuarios/${ctx.superadminId}/permanente`, `/usuarios/${ctx.alumnoUsuarioId}/permanente`]) {
      expect((await ctx.api(rutaBloqueada, { method: 'DELETE', token: root, body: { confirmacion: 'ELIMINAR' } })).response.status).toBe(409);
    }
  });

  it('revierte la limpieza ante una referencia de notificación y conserva autorías sin FK', async () => {
    const root = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.superadminId })).email);
    const alta = await ctx.api('/usuarios', { method: 'POST', token: root, body: {
      email: `del_rollback_${ctx.sufijo}@example.invalid`, password: 'Integracion_Segura_42!',
      nombre: 'Eliminar', apellidoPaterno: 'Rollback', roles: ['ADMINISTRATIVO'], plantelIds: [ctx.plantelId],
    } });
    expect(alta.response.status).toBe(201);
    const id: number = alta.data.id;
    const token = await ctx.emitirToken(alta.data.email);
    const borrar = () => ctx.api(`/usuarios/${id}/permanente`, { method: 'DELETE', token: root, body: { confirmacion: 'ELIMINAR' } });
    const historial = await ctx.dataSource.getRepository(BitacoraFinanciera).save({ usuarioId: id, plantelId: ctx.plantelId, accion: 'PRUEBA', entidad: 'prueba', entidadId: null, detalle: null });
    expect((await borrar()).response.status).toBe(409);
    expect(await ctx.dataSource.getRepository(Usuario).findOneBy({ id })).not.toBeNull();
    await ctx.dataSource.getRepository(BitacoraFinanciera).delete(historial.id);

    const sesion = await ctx.dataSource.getRepository(Sesion).findOneByOrFail({ usuarioId: id, revocada: false });
    const propia = await ctx.dataSource.getRepository(PushDispositivo).save({ usuarioId: id, sesionId: sesion.id, instalacionId: randomUUID(), token: `ExponentPushToken[del${ctx.sufijo}]`, activo: false, actualizadoEn: new Date() });
    const sesionRoot = await ctx.dataSource.getRepository(Sesion).findOneByOrFail({ usuarioId: ctx.superadminId, revocada: false });
    const ajena = await ctx.dataSource.getRepository(PushDispositivo).save({ usuarioId: ctx.superadminId, sesionId: sesionRoot.id, instalacionId: randomUUID(), token: `ExponentPushToken[delroot${ctx.sufijo}]`, activo: false, actualizadoEn: new Date() });
    const aviso = await ctx.dataSource.getRepository(Notificacion).save({ usuarioId: id, titulo: 'Rollback', mensaje: 'Fixture cruzado', pushPendiente: false });
    const envio = await ctx.dataSource.getRepository(PushEnvio).save({ notificacionId: aviso.id, dispositivoId: ajena.id, estado: 'ENTREGADO', intentos: 1, proximoIntento: new Date(), ticketId: null, error: null });
    expect((await borrar()).response.status).toBe(409);
    expect(await ctx.dataSource.getRepository(PushDispositivo).findOneBy({ id: propia.id })).not.toBeNull();
    expect(await ctx.dataSource.getRepository(Notificacion).findOneBy({ id: aviso.id })).not.toBeNull();
    expect((await ctx.api('/auth/me', { token })).response.status).toBe(200);
    await ctx.dataSource.getRepository(PushEnvio).delete(envio.id);
    expect((await borrar()).response.status).toBe(200);
  });

}
