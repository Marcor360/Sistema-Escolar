import { expect, it } from '@jest/globals';
import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { ActivacionService } from '../../src/auth/activacion.service';
import { AuthService } from '../../src/auth/auth.service';
import { ClavesCorreoAcceso } from '../../src/auth/correo-acceso-claves';
import { CorreoAccesoOutboxService } from '../../src/auth/correo-acceso-outbox.service';
import { Alumno, AuthCorreoOutbox, BitacoraAcademica, Cargo, CicloEscolar, ConceptoPago, EgresoAlumno, Grupo, Inscripcion, Pago, Usuario } from '../../src/entities';
import { ContextoIntegracion } from './contexto';
import { curpFicticia } from './identidad-ficticia';

/** Recorridos HTTP con identidades propias: no dependen del estado de otro caso. */
export function registrarCicloAlumno(ctx: ContextoIntegracion) {
  const root = async () => ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.superadminId })).email);
  const crear = async (etiqueta: string, token: string) => {
    const body = {
      nombre: 'Alumno', apellidoPaterno: 'Piloto', apellidoMaterno: 'Sintético',
      email: `piloto_${etiqueta}_${ctx.sufijo}@example.invalid`,
      matricula: `P${etiqueta}${ctx.sufijo}`.slice(0, 20), curp: curpFicticia(), plantelId: ctx.plantelId,
    };
    const r = await ctx.api('/alumnos', { method: 'POST', token, body });
    expect({ status: r.response.status, data: r.data }).toMatchObject({ status: 201 });
    return { ...body, id: r.data.id as number, usuarioId: r.data.usuarioId as number };
  };
  const codigo = async (usuarioId: number, tipo: 'ACTIVACION' | 'RECUPERACION') => {
    const u = await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: usuarioId });
    const outbox = ctx.app.get(CorreoAccesoOutboxService);
    await outbox.solicitar(u.email!, tipo);
    let trabajo: AuthCorreoOutbox | null = null;
    for (let i = 0; i < 20; i++) {
      await outbox.procesar();
      trabajo = await ctx.dataSource.getRepository(AuthCorreoOutbox).findOne({
        where: { usuarioId, tipo, version: u.sessionVersion }, order: { createdAt: 'DESC' },
      });
      if (trabajo?.tokenHash) break;
    }
    expect(trabajo?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    return new ClavesCorreoAcceso(ctx.app.get(ConfigService)).token(trabajo!);
  };

  it('ciclo alumno: alta normalizada, duplicados y cambios de identidad inválidos no dejan cuentas huérfanas', async () => {
    const token = await root(), a = await crear('id', token);
    const antes = await ctx.dataSource.getRepository(Usuario).count();
    for (const body of [
      { ...a, email: `dup_curp_${ctx.sufijo}@example.invalid`, matricula: `DC${ctx.sufijo}` },
      { ...a, email: `dup_mat_${ctx.sufijo}@example.invalid`, curp: curpFicticia() },
      { ...a, curp: curpFicticia(), matricula: `DE${ctx.sufijo}` },
    ]) {
      expect((await ctx.api('/alumnos', { method: 'POST', token, body })).response.status).toBe(409);
    }
    expect(await ctx.dataSource.getRepository(Usuario).count()).toBe(antes);
    expect((await ctx.api(`/alumnos/${a.id}`, { method: 'PATCH', token, body: { curp: null } })).response.status).toBe(400);
    expect((await ctx.api(`/alumnos/${a.id}`, { method: 'PATCH', token, body: { nombre: '  Corregido  ', segundoNombre: ' Dos ', direccion: null } })).data.usuario).toMatchObject({ nombre: 'Corregido', segundoNombre: 'Dos' });
    expect((await ctx.dataSource.getRepository(Alumno).findOneByOrFail({ id: a.id })).curp).toBe(a.curp);
    const local = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.adminId })).email);
    expect((await ctx.api(`/alumnos/${a.id}/transferencia`, { method: 'POST', token: local, body: { plantelId: ctx.otroPlantelId } })).response.status).toBe(403);
    expect((await ctx.dataSource.getRepository(Alumno).findOneByOrFail({ id: a.id })).plantelId).toBe(ctx.plantelId);
  });

  it('ciclo alumno: baja y reactivación invalidan también el código anterior de activación', async () => {
    const token = await root(), a = await crear('act', token);
    const anterior = await codigo(a.usuarioId, 'ACTIVACION');
    expect((await ctx.api(`/alumnos/${a.id}/baja`, { method: 'POST', token })).response.status).toBe(201);
    expect((await ctx.api(`/alumnos/${a.id}/reactivacion`, { method: 'POST', token, body: { motivo: 'Retorno documentado de prueba' } })).response.status).toBe(201);
    await expect(ctx.app.get(ActivacionService).activar(anterior, 'Piloto_Nueva_13515!')).rejects.toThrow();
    expect((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: a.usuarioId })).activacionPendiente).toBe(true);
    const nuevo = await codigo(a.usuarioId, 'ACTIVACION');
    expect(nuevo).not.toBe(anterior);
    await ctx.app.get(ActivacionService).activar(nuevo, 'Piloto_Nueva_13515!');
    expect((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: a.usuarioId })).activacionPendiente).toBe(false);
  });

  it('ciclo alumno: transferencia, baja y retorno conservan cobros e historial sin revivir sesiones ni códigos de recuperación', async () => {
    const token = await root(), a = await crear('vida', token);
    const alumnoToken = await ctx.emitirToken(a.email);
    const anterior = await codigo(a.usuarioId, 'RECUPERACION');
    const ciclo = await ctx.dataSource.getRepository(CicloEscolar).save({ clave: `PV${ctx.sufijo}`, nombre: 'Piloto sintético', fechaInicio: '2060-01-01', fechaFin: '2060-12-31', estado: 'CERRADO', activo: false });
    const grupo = await ctx.dataSource.getRepository(Grupo).save({ cicloId: ciclo.id, plantelId: ctx.plantelId, nombre: 'Piloto ciclo alumno' });
    // Solo prepara un antecedente en esta BD nueva; la inscripción ordinaria tiene su recorrido por cartera.
    const inscripcion = await ctx.dataSource.getRepository(Inscripcion).save({ alumnoId: a.id, grupoId: grupo.id, estatus: 'ACTIVA' });
    const concepto = await ctx.dataSource.getRepository(ConceptoPago).save({ clave: `PV${ctx.sufijo}`, nombre: 'Piloto', tipo: 'OTRO', montoBase: 100 });
    const cargo = await ctx.api('/finanzas/cargos', { method: 'POST', token, body: { alumnoId: a.id, conceptoId: concepto.id, descripcion: 'Antecedente piloto', monto: 100 } });
    expect(cargo.response.status).toBe(201);
    const pago = await ctx.api('/finanzas/pagos', { method: 'POST', token, body: { claveIdempotencia: randomUUID(), alumnoId: a.id, cargoId: cargo.data.id, monto: 40, metodo: 'EFECTIVO' } });
    expect(pago.response.status).toBe(201);
    expect((await ctx.api(`/alumnos/${a.id}/transferencia`, { method: 'POST', token, body: { plantelId: ctx.otroPlantelId } })).response.status).toBe(201);
    expect((await ctx.dataSource.getRepository(Inscripcion).findOneByOrFail({ id: inscripcion.id })).estatus).toBe('BAJA');
    expect((await ctx.api(`/alumnos/${a.id}/baja`, { method: 'POST', token })).response.status).toBe(201);
    expect((await ctx.api('/auth/me', { token: alumnoToken })).response.status).toBe(401);
    expect((await ctx.api(`/alumnos/${a.id}/baja`, { method: 'POST', token })).response.status).toBe(409);
    expect((await ctx.api(`/alumnos/${a.id}/reactivacion`, { method: 'POST', token, body: { motivo: '   ' } })).response.status).toBe(400);
    expect((await ctx.api(`/alumnos/${a.id}/reactivacion`, { method: 'POST', token, body: { motivo: 'Reingreso documentado de prueba' } })).response.status).toBe(201);
    expect((await ctx.api('/auth/me', { token: alumnoToken })).response.status).toBe(401);
    await expect(ctx.app.get(AuthService).resetPassword(anterior, 'Piloto_Nueva_13515!')).rejects.toThrow();
    expect(await ctx.dataSource.getRepository(Inscripcion).countBy({ alumnoId: a.id, estatus: 'ACTIVA' })).toBe(0);
    expect(await ctx.dataSource.getRepository(Cargo).findOneByOrFail({ id: cargo.data.id })).toMatchObject({ alumnoId: a.id, plantelId: ctx.plantelId, monto: 100 });
    expect(await ctx.dataSource.getRepository(Pago).countBy({ cargoId: cargo.data.id })).toBe(1);
    expect((await ctx.api(`/alumnos/${a.id}/permanente`, { method: 'DELETE', token, body: { confirmacion: 'ELIMINAR' } })).response.status).toBe(409);
    expect(await ctx.dataSource.getRepository(BitacoraAcademica).countBy({ entidadId: a.id, accion: 'ALUMNO_REACTIVADO' })).toBe(1);
    await ctx.app.get(AuthService).resetPassword(await codigo(a.usuarioId, 'RECUPERACION'), 'Piloto_Nueva_13515!');
    await ctx.dataSource.getRepository(CicloEscolar).update(ciclo.id, { activo: false });
  });

  it('ciclo alumno: un código de recuperación previo a la baja no recupera validez al reactivar', async () => {
    const token = await root(), a = await crear('rec', token);
    await ctx.emitirToken(a.email);
    const anterior = await codigo(a.usuarioId, 'RECUPERACION');
    expect((await ctx.api(`/alumnos/${a.id}/baja`, { method: 'POST', token })).response.status).toBe(201);
    expect((await ctx.api(`/alumnos/${a.id}/reactivacion`, { method: 'POST', token, body: { motivo: 'Retorno sintético documentado' } })).response.status).toBe(201);
    await expect(ctx.app.get(AuthService).resetPassword(anterior, 'Piloto_Nueva_13515!')).rejects.toThrow();
  });

  it('ciclo alumno: corregir contacto no revoca la activación pendiente', async () => {
    const token = await root(), a = await crear('cont', token);
    const vigente = await codigo(a.usuarioId, 'ACTIVACION');
    expect((await ctx.api(`/alumnos/${a.id}`, { method: 'PATCH', token, body: { telefono: '5551234567', tutorNombre: 'Tutor corregido' } })).response.status).toBe(200);
    await ctx.app.get(ActivacionService).activar(vigente, 'Piloto_Nueva_13515!');
    expect((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: a.usuarioId })).activacionPendiente).toBe(false);
  });

  it('ciclo alumno: egreso exige cierre y conserva expediente; no admite baja, reactivación ni eliminación posterior', async () => {
    const token = await root(), a = await crear('eg', token);
    const alumnoToken = await ctx.emitirToken(a.email);
    expect((await ctx.api(`/alumnos/${a.id}/egreso`, { method: 'POST', token })).response.status).toBe(409);
    const ciclo = await ctx.dataSource.getRepository(CicloEscolar).save({ clave: `PE${ctx.sufijo}`, nombre: 'Antecedente egreso', fechaInicio: '2061-01-01', fechaFin: '2061-12-31', estado: 'ACTIVO', activo: true });
    const grupo = await ctx.dataSource.getRepository(Grupo).save({ cicloId: ciclo.id, plantelId: ctx.plantelId, nombre: 'Egreso piloto' });
    await ctx.dataSource.getRepository(Inscripcion).save({ alumnoId: a.id, grupoId: grupo.id, estatus: 'ACTIVA' });
    expect((await ctx.api(`/alumnos/${a.id}/egreso`, { method: 'POST', token })).response.status).toBe(409);
    // Precondición sintética: cierre institucional se comprueba en el recorrido académico existente.
    await ctx.dataSource.getRepository(CicloEscolar).update(ciclo.id, { estado: 'CERRADO', activo: false });
    expect((await ctx.api(`/alumnos/${a.id}/egreso`, { method: 'POST', token })).response.status).toBe(201);
    for (const accion of ['egreso', 'baja', 'reactivacion']) {
      expect((await ctx.api(`/alumnos/${a.id}/${accion}`, { method: 'POST', token, body: { motivo: 'Intento inválido' } })).response.status).toBe(409);
    }
    expect((await ctx.api('/auth/me', { token: alumnoToken })).response.status).toBe(401);
    expect(await ctx.dataSource.getRepository(EgresoAlumno).countBy({ alumnoId: a.id })).toBe(1);
    expect((await ctx.api(`/alumnos/${a.id}/historial/listado`, { token })).data).toMatchObject({ total: 1, egreso: { cicloId: ciclo.id } });
    expect((await ctx.api(`/alumnos/${a.id}/permanente`, { method: 'DELETE', token, body: { confirmacion: 'ELIMINAR' } })).response.status).toBe(409);
  });
}
