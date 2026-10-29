import { EntitySubscriberInterface } from 'typeorm';
import { AuthCorreoOutbox } from '../../src/entities/auth-correo-outbox.entity';
import { expect, it } from '@jest/globals';
import { randomUUID } from 'crypto';
import { Alumno, AperturaCartera, Cargo, ConceptoPago, Pago, Usuario } from '../../src/entities';
import { ContextoIntegracion } from './contexto';
import { curpFicticia } from './identidad-ficticia';

export function registrarCarteraIntegral(ctx: ContextoIntegracion) {
  it('cartera integral: alta atómica sin correo, pausa aislada, cuotas únicas, pagos y activación posterior', async () => {
    const token = await ctx.emitirToken(
      (await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.adminId })).email,
    );
    const post = async (ruta: string, body: unknown) => {
      const r = await ctx.api(ruta, { method: 'POST', token, body });
      expect({ status: r.response.status, respuesta: r.data }).toMatchObject({ status: 201 });
      return r.data;
    };
    const ciclo = await post('/academico/ciclos', {
      clave: `INT${ctx.sufijo}`,
      nombre: 'Cartera integral QA',
      fechaInicio: '2057-01-01',
      fechaFin: '2057-12-31',
    });
    const nivel = await post('/academico/catalogos/niveles', {
      plantelId: ctx.plantelId,
      clave: `INT${ctx.sufijo}`,
      nombre: 'Nivel integral',
    });
    const carrera = await post('/academico/catalogos/carreras', {
      plantelId: ctx.plantelId,
      nivelId: nivel.id,
      clave: `INT${ctx.sufijo}`,
      nombre: 'Plan integral',
      versionPlan: 'QA',
    });
    const periodo = await post('/academico/catalogos/periodos', {
      plantelId: ctx.plantelId,
      carreraId: carrera.id,
      cicloId: ciclo.id,
      clave: 'P1',
      nombre: 'Primero',
      tipo: 'ANUAL',
      numero: 1,
    });
    const concepto = await ctx.dataSource.getRepository(ConceptoPago).save({
      clave: `INT${ctx.sufijo}`,
      nombre: 'Colegiatura QA',
      tipo: 'COLEGIATURA',
      montoBase: 100,
      activo: true,
      aplicaRecargo: false,
    });
    const base = {
      plantelId: ctx.plantelId,
      cicloId: ciclo.id,
      nivelId: nivel.id,
      carreraId: carrera.id,
      periodoAcademicoId: periodo.id,
      turno: 'MATUTINO',
      asignacion: 'PAUSA',
      total: 200,
      cuotas: [
        { conceptoId: concepto.id, monto: 100, periodo: '2057-02', fechaVencimiento: '2057-02-05' },
        { conceptoId: concepto.id, monto: 100, periodo: '2057-03', fechaVencimiento: '2057-03-05' },
      ],
    };
    const identidad = {
      nombre: 'Alumno Integral',
      apellidoPaterno: 'Prueba',
      matricula: `INT${ctx.sufijo}`,
      curp: curpFicticia(),
    };
    const payload = { ...base, nuevoAlumno: identidad };
    const antes = await ctx.dataSource.getRepository(Alumno).count();
    expect(
      (await ctx.api('/cartera/integral/previsualizar', { method: 'POST', token, body: { ...payload, total: 201 } }))
        .response.status,
    ).toBe(400);
    expect(
      (
        await ctx.api('/cartera/integral/previsualizar', {
          method: 'POST',
          token,
          body: { ...payload, cuotas: [base.cuotas[0], base.cuotas[0]] },
        })
      ).response.status,
    ).toBe(400);
    const q = await post('/cartera/integral/previsualizar', payload);
    expect(await ctx.dataSource.getRepository(Alumno).count()).toBe(antes);
    const confirmar = { ...payload, cotizacion: q.cotizacion, idempotencia: randomUUID(), confirmado: true };
    const rs = await Promise.all([
      post('/cartera/integral/confirmar', confirmar),
      post('/cartera/integral/confirmar', confirmar),
    ]);
    expect(rs[0].id).toBe(rs[1].id);
    expect(rs[0].estado).toBe('PAUSA');
    expect(rs[0].total).toBe(200);
    const a = await ctx.dataSource.getRepository(Alumno).findOneByOrFail({ id: rs[0].alumnoId });
    expect(a.usuario.email).toBeNull();
    expect(a.usuario.activacionPendiente).toBe(true);
    expect(await ctx.dataSource.getRepository(AuthCorreoOutbox).countBy({ usuarioId: a.usuarioId })).toBe(0);
    expect(await ctx.dataSource.getRepository(Cargo).countBy({ alumnoId: a.id })).toBe(0);
    const duplicado = await ctx.api('/cartera/integral/previsualizar', {
      method: 'POST',
      token,
      body: { ...payload, nuevoAlumno: { ...identidad, matricula: `DUP${ctx.sufijo}` } },
    });
    expect(duplicado.response.status).toBe(409);
    const listado = await ctx.api(
      `/cartera/alumnos-elegibles?plantelId=${ctx.plantelId}&buscar=${identidad.matricula}`,
      { token },
    );
    expect(listado.data.total).toBe(0);
    const sinCorreo = await ctx.api(`/usuarios/listado?tipo=ALUMNO&sinCorreo=true&buscar=${identidad.matricula}`, {
      token,
    });
    expect(sinCorreo.data.datos).toEqual([expect.objectContaining({ id: a.id, correo: null })]);
    const grupo = await post('/academico/grupos', { ...base, nombre: `INT-${ctx.sufijo}`, tipo: 'REGULAR' });
    // Si falla un cargo, tampoco queda un expediente huérfano.
    const fallidoPayload = {
      ...base,
      asignacion: 'GRUPO',
      grupoId: grupo.id,
      nuevoAlumno: { ...identidad, matricula: `QAFX${ctx.sufijo}`, curp: curpFicticia() },
    };
    const fallidoQ = await post('/cartera/integral/previsualizar', fallidoPayload);
    const usuariosAntes = await ctx.dataSource.getRepository(Usuario).count();
    const falla: EntitySubscriberInterface<Cargo> = {
      listenTo: () => Cargo,
      beforeInsert: (e) => {
        if (e.entity.cicloId === ciclo.id) throw new Error('Fallo sintético de cargo integral');
      },
    };
    ctx.dataSource.subscribers.push(falla);
    try {
      expect(
        (
          await ctx.api('/cartera/integral/confirmar', {
            method: 'POST',
            token,
            body: { ...fallidoPayload, cotizacion: fallidoQ.cotizacion, idempotencia: randomUUID(), confirmado: true },
          })
        ).response.status,
      ).toBe(500);
    } finally {
      ctx.dataSource.subscribers.splice(ctx.dataSource.subscribers.indexOf(falla), 1);
    }
    expect(
      await ctx.dataSource.getRepository(Alumno).findOneBy({ matricula: fallidoPayload.nuevoAlumno.matricula }),
    ).toBeNull();
    expect(await ctx.dataSource.getRepository(Usuario).count()).toBe(usuariosAntes);
    // Alumno existente con colegiatura pagada: vincular, no volver a generar ese cargo.
    const root = await ctx.emitirToken(
      (await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.superadminId })).email,
    );
    const existente = await ctx.api('/alumnos', {
      method: 'POST',
      token: root,
      body: {
        ...identidad,
        matricula: `ANT${ctx.sufijo}`,
        curp: curpFicticia(),
        plantelId: ctx.plantelId,
        email: `ant${ctx.sufijo}@example.invalid`,
      },
    });
    expect(existente.response.status).toBe(201);
    const previo = await ctx.dataSource
      .getRepository(Cargo)
      .save({
        plantelId: ctx.plantelId,
        alumnoId: existente.data.id,
        cicloId: ciclo.id,
        conceptoId: concepto.id,
        periodo: '2057-02',
        fechaVencimiento: '2057-02-05',
        descripcion: 'Colegiatura anterior pagada',
        monto: 100,
        descuento: 0,
        recargo: 0,
        estatus: 'PAGADO',
      });
    const pago = await ctx.dataSource
      .getRepository(Pago)
      .save({
        plantelId: ctx.plantelId,
        alumnoId: existente.data.id,
        cargoId: previo.id,
        monto: 100,
        metodo: 'EFECTIVO',
        estatus: 'CONFIRMADO',
      });
    expect((await ctx.api(`/cartera/alumnos-elegibles?buscar=ANT${ctx.sufijo}`, { token })).data.datos).toEqual([
      expect.objectContaining({ id: existente.data.id }),
    ]);
    const existentePayload = { ...base, alumnoId: existente.data.id, asignacion: 'GRUPO', grupoId: grupo.id };
    const existenteQ = await post('/cartera/integral/previsualizar', existentePayload);
    expect(existenteQ.conceptos[0].cargoId).toBe(previo.id);
    const existenteCartera = await post('/cartera/integral/confirmar', {
      ...existentePayload,
      cotizacion: existenteQ.cotizacion,
      idempotencia: randomUUID(),
      confirmado: true,
    });
    expect(existenteCartera.estado).toBe('ABIERTA');
    expect(await ctx.dataSource.getRepository(Cargo).countBy({ alumnoId: existente.data.id })).toBe(2);
    expect(await ctx.dataSource.getRepository(Pago).findOneBy({ id: pago.id })).toMatchObject({
      monto: 100,
      estatus: 'CONFIRMADO',
      cargoId: previo.id,
    });
    // Otra apertura no puede reanudar ni cobrar la cartera pausada.
    const otroPayload = {
      ...base,
      nuevoAlumno: { ...identidad, matricula: `IN2${ctx.sufijo}`, curp: curpFicticia() },
      asignacion: 'GRUPO',
      grupoId: grupo.id,
    };
    const otroQ = await post('/cartera/integral/previsualizar', otroPayload);
    const otro = await post('/cartera/integral/confirmar', {
      ...otroPayload,
      cotizacion: otroQ.cotizacion,
      idempotencia: randomUUID(),
      confirmado: true,
    });
    expect(otro.estado).toBe('ABIERTA');
    expect(await ctx.dataSource.getRepository(Cargo).countBy({ alumnoId: a.id })).toBe(0);
    const reanudada = await post(`/cartera/${rs[0].id}/reanudar`, {
      grupoId: grupo.id,
      motivo: 'Reincorporación autorizada por Control Escolar',
      confirmado: true,
    });
    expect(reanudada.estado).toBe('ABIERTA');
    await post(`/cartera/${rs[0].id}/reanudar`, {
      grupoId: grupo.id,
      motivo: 'Reintento de reincorporación sin duplicados',
      confirmado: true,
    });
    const cargos = await ctx.dataSource.getRepository(Cargo).findBy({ alumnoId: a.id });
    expect(cargos).toHaveLength(2);
    expect(cargos.reduce((n, c) => n + c.monto, 0)).toBe(200);
    await ctx.dataSource.getRepository(Pago).save({
      plantelId: ctx.plantelId,
      alumnoId: a.id,
      cargoId: cargos[0].id,
      monto: 40,
      metodo: 'EFECTIVO',
      estatus: 'CONFIRMADO',
    });
    const detalle = await ctx.api(`/cartera/${rs[0].id}`, { token });
    expect(detalle.data.financiero).toMatchObject({ pagado: 40, saldo: 160 });
    const trayectoria = await ctx.api(`/cartera/reinscripciones/alumnos/${a.id}`, { token });
    expect(trayectoria.response.status).toBe(200);
    expect(trayectoria.data.financiero).toMatchObject({ pagado: 40, saldo: 160 });
    const ajeno = await ctx.emitirFinanzasB();
    expect((await ctx.api(`/cartera/${rs[0].id}`, { token: ajeno })).response.status).toBe(403);
    expect(
      (
        await ctx.api(`/usuarios/alumnos/${a.id}/correo-institucional`, {
          method: 'POST',
          token: ajeno,
          body: { email: `int${ctx.sufijo}@example.invalid`, correoProveedor: 'MICROSOFT365' },
        })
      ).response.status,
    ).toBe(403);
    await post(`/usuarios/alumnos/${a.id}/correo-institucional`, {
      email: `int${ctx.sufijo}@example.invalid`,
      correoProveedor: 'MICROSOFT365',
    });
    expect(await ctx.dataSource.getRepository(AuthCorreoOutbox).countBy({ usuarioId: a.usuarioId })).toBe(1);
    await post(`/usuarios/alumnos/${a.id}/correo-institucional`, {
      email: `int${ctx.sufijo}@example.invalid`,
      correoProveedor: 'MICROSOFT365',
    });
    expect(await ctx.dataSource.getRepository(AuthCorreoOutbox).countBy({ usuarioId: a.usuarioId })).toBe(1);
    expect(
      (
        await ctx.api(`/usuarios/alumnos/${a.id}/correo-institucional`, {
          method: 'POST',
          token,
          body: { email: `cambio${ctx.sufijo}@example.invalid`, correoProveedor: 'MICROSOFT365' },
        })
      ).response.status,
    ).toBe(409);
    const alumnoToken = await ctx.emitirToken(`int${ctx.sufijo}@example.invalid`);
    expect(alumnoToken).toBeTruthy();
    expect(await ctx.dataSource.getRepository(AperturaCartera).countBy({ alumnoId: a.id })).toBe(1);
  });
}
