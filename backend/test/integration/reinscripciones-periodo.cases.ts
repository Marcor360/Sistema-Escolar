import { clasesRecursadas } from '../../src/recursamientos/acceso-recursamiento';
import { ConfirmarCarteraDto } from '../../src/cartera/cartera.dto';
import { ConfirmarPeriodoDto } from '../../src/cartera/reinscripcion-periodo.dto';
import { expect, it } from '@jest/globals';
import { randomUUID } from 'crypto';
import { EntitySubscriberInterface } from 'typeorm';
import { ContextoIntegracion } from './contexto';
import {
  AutorizacionReinscripcion,
  Calificacion,
  Cargo,
  CicloEscolar,
  ConceptoPago,
  Grupo,
  GrupoMateria,
  Inscripcion,
  Materia,
  Pago,
  PeriodoCalificacion,
  ParticipacionAsignatura,
  ReinscripcionPeriodo,
  Usuario,
} from '../../src/entities';
export function registrarReinscripcionesPeriodo(ctx: ContextoIntegracion) {
  let secuencia = 0,
    adminPuroId: number | undefined;
  const token = async (id: number) =>
    ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id })).email);
  const preparar = async (
    tipo: 'ANUAL' | 'SEMESTRAL' | 'CUATRIMESTRAL' = 'CUATRIMESTRAL',
    numeroOrigen = 3,
    numeroDestino = 4,
    grupoManual = true,
  ) => {
    const ds = ctx.dataSource,
      n = ++secuencia,
      root = await token(ctx.superadminId),
      fin = await token(ctx.finanzasId);
    if (!adminPuroId) {
      const nuevo = await ctx.api('/usuarios', {
        method: 'POST',
        token: root,
        body: {
          email: `rp_admin_${ctx.sufijo}@example.invalid`,
          nombre: 'Control Escolar',
          apellidoPaterno: 'Reinscripción',
          password: 'Integracion_Segura_42!',
          roles: ['ADMINISTRATIVO'],
          plantelIds: [ctx.plantelId],
        },
      });
      expect(nuevo.response.status).toBe(201);
      adminPuroId = nuevo.data.id;
    }
    const admin = await token(adminPuroId!);
    const post = (ruta: string, body: unknown, actor = root) => ctx.api(ruta, { method: 'POST', token: actor, body });
    const alta = async (ruta: string, body: unknown) => {
      const r = await post(ruta, body);
      expect(r.response.status).toBe(201);
      return r.data;
    };
    const ciclo = await ds.getRepository(CicloEscolar).save({
      clave: `RP${n}${ctx.sufijo}`,
      nombre: 'Ciclo fixture reinscripción',
      fechaInicio: '2026-01-01',
      fechaFin: '2026-12-31',
      estado: 'ACTIVO',
      activo: true,
    });
    const cicloOrigen =
      tipo === 'ANUAL'
        ? await ds
            .getRepository(CicloEscolar)
            .save({
              clave: `RPO${n}${ctx.sufijo}`,
              nombre: 'Origen anual histórico',
              fechaInicio: '2025-01-01',
              fechaFin: '2025-12-31',
              estado: 'PREPARACION',
              activo: false,
            })
        : ciclo;
    const nivel = await alta('/academico/catalogos/niveles', {
      plantelId: ctx.plantelId,
      clave: `RP${n}${ctx.sufijo}`,
      nombre: 'Nivel de reinscripción',
    });
    const carrera = await alta('/academico/catalogos/carreras', {
      plantelId: ctx.plantelId,
      nivelId: nivel.id,
      clave: `RP${n}${ctx.sufijo}`,
      nombre: 'Plan de reinscripción',
      versionPlan: 'Fixture 2026',
    });
    const periodo = (numero: number, inicio: string, fin: string, cicloId = ciclo.id) =>
      alta('/academico/catalogos/periodos', {
        plantelId: ctx.plantelId,
        carreraId: carrera.id,
        cicloId,
        clave: `P${numero}`,
        nombre: `Periodo ${numero}`,
        tipo,
        numero,
        fechaInicio: inicio,
        fechaFin: fin,
      });
    const inicioDestino = tipo === 'ANUAL' ? '2026-01-01' : tipo === 'SEMESTRAL' ? '2026-07-01' : '2026-05-01';
    const finDestino = tipo === 'CUATRIMESTRAL' ? '2026-08-31' : '2026-12-31';
    const origenPeriodo = await periodo(
      numeroOrigen,
      cicloOrigen.fechaInicio,
      tipo === 'ANUAL' ? '2025-12-31' : tipo === 'SEMESTRAL' ? '2026-06-30' : '2026-04-30',
      cicloOrigen.id,
    );
    const destinoPeriodo = await periodo(numeroDestino, inicioDestino, finDestino);
    if (tipo === 'ANUAL')
      await ds.getRepository(CicloEscolar).update(cicloOrigen.id, { estado: 'CERRADO', activo: false });
    const base = {
      cicloId: ciclo.id,
      plantelId: ctx.plantelId,
      nivelId: nivel.id,
      carreraId: carrera.id,
      turno: 'MATUTINO' as const,
      tipo: 'REGULAR' as const,
      activo: true,
    };
    const origenGrupo = await ds
      .getRepository(Grupo)
      .save({ ...base, cicloId: cicloOrigen.id, nombre: `Origen ${n}`, periodoAcademicoId: origenPeriodo.id });
    const destinoGrupo = grupoManual
      ? await ds.getRepository(Grupo).save({ ...base, nombre: `Destino ${n}`, periodoAcademicoId: destinoPeriodo.id })
      : null;
    const materia = await ds
      .getRepository(Materia)
      .save({ clave: `RP${n}${ctx.sufijo}`, nombre: 'Asignatura fixture', creditos: 5 });
    const clase = await ds.getRepository(GrupoMateria).save({ grupoId: origenGrupo.id, materiaId: materia.id });
    await ds.getRepository(PeriodoCalificacion).save({
      grupoMateriaId: clase.id,
      parcial: 0,
      estatus: 'CERRADO',
      cerradoPorId: ctx.superadminId,
      cerradoAt: new Date(),
    });
    const concepto = await ds.getRepository(ConceptoPago).save({
      clave: `RP${n}${ctx.sufijo}`,
      nombre: 'Colegiatura total del periodo',
      tipo: 'COLEGIATURA',
      montoBase: 1200,
      activo: true,
      aplicaRecargo: false,
    });
    const alumno = async () => {
      const s = ++secuencia,
        a = await alta('/alumnos', {
          email: `rp${s}_${ctx.sufijo}@example.invalid`,
          nombre: 'María José',
          apellidoPaterno: 'Prueba',
          curp: `RPAA010101HDFLRN${String(s).padStart(2, '0')}`,
          matricula: `RP${s}${ctx.sufijo}`,
          plantelId: ctx.plantelId,
        });
      // Fuente histórica sintética. Las altas nuevas se prueban exclusivamente por API/cartera.
      const inscripcion = await ds
        .getRepository(Inscripcion)
        .save({ alumnoId: a.id, grupoId: origenGrupo.id, estatus: 'ACTIVA' });
      const nota = await ds.getRepository(Calificacion).save({
        alumnoId: a.id,
        grupoMateriaId: clase.id,
        parcial: 0,
        calificacion: 8,
        escalaMaxima: 10,
        capturadaPorId: ctx.superadminId,
      });
      return {
        a,
        inscripcion,
        nota,
        payload: {
          alumnoId: a.id,
          ...base,
          origenInscripcionId: inscripcion.id,
          periodoAcademicoId: destinoPeriodo.id,
          ...(destinoGrupo ? { grupoId: destinoGrupo.id } : {}),
          conceptoIds: [concepto.id],
          periodo: inicioDestino.slice(0, 7),
          fechaVencimiento: inicioDestino.slice(0, 7) + '-15',
        },
      };
    };
    const autorizar = async (payload: unknown) => {
      const preview = await post('/cartera/reinscripciones/previsualizar', payload, fin);
      expect(preview.response.status).toBe(201);
      const r = await post(
        '/cartera/reinscripciones/autorizar-precio',
        { ...(payload as object), cotizacion: preview.data.cotizacion },
        fin,
      );
      expect(r.response.status).toBe(201);
      return {
        autorizacionId: r.data.autorizacionId,
        cotizacion: r.data.cotizacion,
        idempotencia: randomUUID(),
        confirmado: true,
      };
    };
    return {
      ds,
      root,
      admin,
      fin,
      post,
      alta,
      ciclo,
      nivel,
      carrera,
      origenPeriodo,
      destinoPeriodo,
      origenGrupo,
      destinoGrupo,
      clase,
      concepto,
      alumno,
      autorizar,
    };
  };
  it('reinscripción por periodo: precio autorizado, cuotas sin doble total, idempotencia e historial intacto', async () => {
    const f = await preparar(),
      a = await f.alumno(),
      alumnoToken = await ctx.emitirToken(a.a.usuario?.email ?? `rp${secuencia}_${ctx.sufijo}@example.invalid`);
    const grupoRecursado = await f.ds.getRepository(Grupo).save({
      cicloId: f.ciclo.id,
      plantelId: ctx.plantelId,
      nombre: `Recursamiento existente ${secuencia}`,
      activo: true,
    });
    const gmRecursada = await f.ds
      .getRepository(GrupoMateria)
      .save({ grupoId: grupoRecursado.id, materiaId: f.clase.materiaId });
    const intento = await f.ds.getRepository(ParticipacionAsignatura).save({
      alumnoId: a.a.id,
      grupoMateriaId: gmRecursada.id,
      inscripcionPrincipalId: a.inscripcion.id,
      idempotencia: randomUUID(),
      intento: 2,
      cupoTotalConfirmado: 1,
      estado: 'ACTIVA',
      activoClave: `RP:${a.a.id}:${gmRecursada.id}`,
    });
    const cargo = await f.ds.getRepository(Cargo).save({
      plantelId: ctx.plantelId,
      alumnoId: a.a.id,
      cicloId: f.ciclo.id,
      conceptoId: f.concepto.id,
      periodo: '2026-02',
      descripcion: 'Cargo histórico pagado',
      monto: 200,
      descuento: 0,
      recargo: 0,
      fechaVencimiento: '2026-02-15',
      estatus: 'PAGADO',
    });
    const pago = await f.ds.getRepository(Pago).save({
      plantelId: ctx.plantelId,
      alumnoId: a.a.id,
      cargoId: cargo.id,
      monto: 200,
      metodo: 'EFECTIVO',
      estatus: 'CONFIRMADO',
      registradoPorId: ctx.finanzasId,
    });
    const cargoAntes = await f.ds.getRepository(Cargo).findOneByOrFail({ id: cargo.id }),
      pagoAntes = await f.ds.getRepository(Pago).findOneByOrFail({ id: pago.id });
    const payload = {
      ...a.payload,
      motivo: 'Beca documentada y avance condicional con recursamiento vigente',
      condicion: 'CONDICIONAL',
      documentoRef: 'ACTA-COND-REC-2026',
      parcialidades: [
        { conceptoId: f.concepto.id, periodo: '2026-05', fechaVencimiento: '2026-05-15', monto: 600, descuento: 100 },
        { conceptoId: f.concepto.id, periodo: '2026-06', fechaVencimiento: '2026-06-15', monto: 600, descuento: 0 },
      ],
    };
    expect((await f.post('/cartera/reinscripciones/previsualizar', payload, alumnoToken)).response.status).toBe(403);
    const preview = await f.post('/cartera/reinscripciones/previsualizar', payload, f.admin);
    expect(preview.response.status).toBe(201);
    expect(preview.data.total).toBe(1100);
    expect(
      (
        await f.post(
          '/cartera/reinscripciones/autorizar-precio',
          { ...payload, cotizacion: preview.data.cotizacion },
          f.admin,
        )
      ).response.status,
    ).toBe(403);
    const financiero = await f.post('/cartera/reinscripciones/previsualizar', payload, f.fin);
    expect(financiero.data.pendientes).toBeUndefined();
    const confirmacion = await f.autorizar(payload);
    expect((await f.post('/cartera/reinscripciones/confirmar', confirmacion, f.fin)).response.status).toBe(403);
    expect(
      (await f.post('/cartera/reinscripciones/confirmar', confirmacion, await ctx.emitirFinanzasB())).response.status,
    ).toBe(403);
    const respuestas = await Promise.all([
      f.post('/cartera/reinscripciones/confirmar', confirmacion, f.admin),
      f.post('/cartera/reinscripciones/confirmar', confirmacion, f.admin),
    ]);
    expect(respuestas.map((r) => ({ status: r.response.status, error: r.data.message ?? null }))).toEqual([
      { status: 201, error: null },
      { status: 201, error: null },
    ]);
    expect(respuestas[0].data.id).toBe(respuestas[1].data.id);
    expect(respuestas[0].data).toMatchObject({ estado: 'CONFIRMADA', total: 1100, grupoId: f.destinoGrupo!.id });
    expect(await f.ds.getRepository(Inscripcion).findOneByOrFail({ id: a.inscripcion.id })).toMatchObject({
      estatus: 'HISTORICA',
      grupoId: f.origenGrupo.id,
    });
    expect(await f.ds.getRepository(Calificacion).findOneByOrFail({ id: a.nota.id })).toMatchObject({
      calificacion: 8,
      escalaMaxima: 10,
    });
    expect(await f.ds.getRepository(Cargo).findOneByOrFail({ id: cargo.id })).toEqual(cargoAntes);
    expect(await f.ds.getRepository(Pago).findOneByOrFail({ id: pago.id })).toEqual(pagoAntes);
    expect(await f.ds.getRepository(ParticipacionAsignatura).findOneByOrFail({ id: intento.id })).toMatchObject({
      intento: 2,
      estado: 'ACTIVA',
      inscripcionPrincipalId: a.inscripcion.id,
    });
    expect(await clasesRecursadas(f.ds.manager, a.a.id)).toContain(gmRecursada.id);
    const nuevos = await f.ds.getRepository(Cargo).find({ where: { alumnoId: a.a.id } });
    expect(nuevos.filter((c) => c.id !== cargo.id)).toHaveLength(2);
    expect(nuevos.reduce((s, c) => s + c.monto - c.descuento, 0)).toBe(1300);
    expect((await ctx.api(`/calificaciones/mias?cicloId=${f.ciclo.id}`, { token: alumnoToken })).data).toEqual(
      expect.arrayContaining([expect.objectContaining({ calificacion: 8 })]),
    );
    const acta = await ctx.api(`/reportes/formatos/acta/${f.clase.id}?parcial=0`, { token: f.root });
    expect(acta.data.filas).toEqual(
      expect.arrayContaining([expect.objectContaining({ alumnoId: a.a.id, calificacion: 8 })]),
    );
    expect((await ctx.api(`/academico/grupos/${f.origenGrupo.id}/alumnos`, { token: f.root })).data).toHaveLength(0);
    expect(
      (await ctx.api(`/academico/grupos/${f.origenGrupo.id}/alumnos?incluirHistoricas=true`, { token: f.root })).data,
    ).toHaveLength(1);
    expect(
      (await f.post('/cartera/reinscripciones/confirmar', { ...confirmacion, idempotencia: randomUUID() }, f.admin))
        .response.status,
    ).toBe(409);
    const anular = await f.post(
      `/cartera/reinscripciones/operaciones/${respuestas[0].data.id}/anular`,
      { motivo: 'Intento de anular una operación confirmada', confirmado: true },
      f.admin,
    );
    expect(anular.response.status).toBe(409);
  });
  it('reinscripción por periodo: 1–4 pendientes, quinto asigna, fallo de cargo revierte y no duplica', async () => {
    const f = await preparar('CUATRIMESTRAL', 3, 4, false),
      alumnos = [];
    for (let n = 0; n < 5; n++) alumnos.push(await f.alumno());
    const confirmaciones: ConfirmarPeriodoDto[] = [];
    for (const a of alumnos) confirmaciones.push(await f.autorizar(a.payload));
    for (let n = 0; n < 4; n++) {
      const r = await f.post('/cartera/reinscripciones/confirmar', confirmaciones[n], f.admin);
      expect(r.response.status).toBe(201);
      expect(r.data.estado).toBe('PENDIENTE');
    }
    expect(await f.ds.getRepository(Cargo).countBy({ cicloId: f.ciclo.id })).toBe(0);
    expect(await f.ds.getRepository(Inscripcion).countBy({ grupoId: f.origenGrupo.id, estatus: 'ACTIVA' })).toBe(5);
    const falla: EntitySubscriberInterface<Cargo> = {
      listenTo: () => Cargo,
      beforeInsert: (e) => {
        if (e.entity.cicloId === f.ciclo.id) throw Error('Fallo sintético de cargo reinscripción');
      },
    };
    f.ds.subscribers.push(falla);
    try {
      expect((await f.post('/cartera/reinscripciones/confirmar', confirmaciones[4], f.admin)).response.status).toBe(
        500,
      );
    } finally {
      f.ds.subscribers.splice(f.ds.subscribers.indexOf(falla), 1);
    }
    expect(await f.ds.getRepository(ReinscripcionPeriodo).countBy({ cicloId: f.ciclo.id })).toBe(4);
    expect(await f.ds.getRepository(Cargo).countBy({ cicloId: f.ciclo.id })).toBe(0);
    expect(await f.ds.getRepository(Inscripcion).countBy({ grupoId: f.origenGrupo.id, estatus: 'ACTIVA' })).toBe(5);
    const r = await f.post('/cartera/reinscripciones/confirmar', confirmaciones[4], f.admin);
    expect(r.response.status).toBe(201);
    expect(r.data.estado).toBe('CONFIRMADA');
    expect(await f.ds.getRepository(ReinscripcionPeriodo).countBy({ cicloId: f.ciclo.id, estado: 'CONFIRMADA' })).toBe(
      5,
    );
    expect(await f.ds.getRepository(Cargo).countBy({ cicloId: f.ciclo.id })).toBe(5);
    expect(await f.ds.getRepository(Inscripcion).countBy({ grupoId: f.origenGrupo.id, estatus: 'HISTORICA' })).toBe(5);
    expect((await f.post('/cartera/reinscripciones/confirmar', confirmaciones[0], f.admin)).data.estado).toBe(
      'CONFIRMADA',
    );
  });
  it('reinscripción por periodo: retroceso documentado, cotización obsoleta y autorización vencida', async () => {
    const f = await preparar('CUATRIMESTRAL', 3, 2),
      a = await f.alumno();
    expect((await f.post('/cartera/reinscripciones/previsualizar', a.payload)).response.status).toBe(409);
    const payload = {
      ...a.payload,
      motivo: 'Retroceso académico autorizado de tercero a segundo',
      documentoRef: 'ACTA-RP-2026',
    };
    const c = await f.autorizar(payload);
    await f.ds.getRepository(Calificacion).update(a.nota.id, { calificacion: 9 });
    expect((await f.post('/cartera/reinscripciones/confirmar', c, f.admin)).response.status).toBe(409);
    expect(await f.ds.getRepository(Cargo).countBy({ cicloId: f.ciclo.id })).toBe(0);
    const vigente = await f.autorizar(payload);
    await f.ds
      .getRepository(AutorizacionReinscripcion)
      .update(vigente.autorizacionId, { venceAt: new Date(Date.now() - 1000) });
    expect((await f.post('/cartera/reinscripciones/confirmar', vigente, f.admin)).response.status).toBe(409);
    const nueva = await f.autorizar(payload);
    expect((await f.post('/cartera/reinscripciones/confirmar', nueva, f.admin)).data.estado).toBe('CONFIRMADA');
  });
  it.each([
    ['ANUAL', 1, 2],
    ['SEMESTRAL', 2, 3],
  ] as const)(
    'reinscripción por periodo: respeta modalidad %s del plan y calendario real',
    async (tipo, origen, destino) => {
      const f = await preparar(tipo, origen, destino),
        a = await f.alumno(),
        c = await f.autorizar(a.payload);
      const r = await f.post('/cartera/reinscripciones/confirmar', c, f.admin);
      expect(r.response.status).toBe(201);
      expect(r.data.estado).toBe('CONFIRMADA');
    },
  );
  it('reinscripción por periodo: no convierte pendientes en cero; condicional documentada y cancelación sin cargos', async () => {
    const f = await preparar('CUATRIMESTRAL', 3, 4, false),
      a = await f.alumno();
    await f.ds.getRepository(Calificacion).update(a.nota.id, { calificacion: 5 });
    expect((await f.post('/cartera/reinscripciones/previsualizar', a.payload)).response.status).toBe(409);
    const c = await f.autorizar({
      ...a.payload,
      condicion: 'CONDICIONAL',
      motivo: 'Control Escolar autoriza avanzar con materia pendiente',
      documentoRef: 'ACTA-COND-2026',
    });
    const r = await f.post('/cartera/reinscripciones/confirmar', c, f.admin);
    expect(r.data.estado).toBe('PENDIENTE');
    const anulada = await f.post(
      `/cartera/reinscripciones/operaciones/${r.data.id}/anular`,
      { motivo: 'El alumno decidió posponer la reinscripción', confirmado: true },
      f.admin,
    );
    expect(anulada.data.estado).toBe('ANULADA');
    expect(await f.ds.getRepository(Inscripcion).findOneByOrFail({ id: a.inscripcion.id })).toMatchObject({
      estatus: 'ACTIVA',
    });
    expect(await f.ds.getRepository(Cargo).countBy({ cicloId: f.ciclo.id })).toBe(0);
    expect((await f.ds.getRepository(Calificacion).findOneByOrFail({ id: a.nota.id })).calificacion).toBe(5);
  });
  it('inscripción regular: siempre exige cartera; reactivación documentada conserva fila sin nuevos cargos', async () => {
    const f = await preparar(),
      a = await f.alumno();
    await f.ds.getRepository(Inscripcion).update(a.inscripcion.id, { estatus: 'BAJA' });
    expect((await f.post(`/academico/grupos/${f.origenGrupo.id}/alumnos`, { alumnoId: a.a.id })).response.status).toBe(
      409,
    );
    const r = await f.post(
      `/academico/grupos/${f.origenGrupo.id}/alumnos`,
      {
        alumnoId: a.a.id,
        motivo: 'Reactivar inscripción histórica previamente documentada',
        documentoRef: 'ACTA-REACT-2026',
      },
      f.admin,
    );
    expect(r.response.status).toBe(201);
    expect(r.data.id).toBe(a.inscripcion.id);
    expect(await f.ds.getRepository(Cargo).countBy({ cicloId: f.ciclo.id })).toBe(0);
    const b = await f.alumno();
    await f.ds.getRepository(Inscripcion).update(b.inscripcion.id, { estatus: 'HISTORICA' });
    expect(
      (
        await f.post(`/academico/grupos/${f.destinoGrupo!.id}/alumnos`, {
          alumnoId: b.a.id,
          motivo: 'Intentar alta directa con motivo no debe eludir cartera',
          documentoRef: 'ACTA-INTENTO',
        })
      ).response.status,
    ).toBe(409);
  });
  it.each(['ORDINARIA', 'REINSCRIPCION'] as const)(
    'cohorte mixta: el quinto por %s asigna altas y reinscripciones sin grupos menores a cinco',
    async (ultimo) => {
      const f = await preparar('CUATRIMESTRAL', 3, 4, false),
        reinscritos = [];
      for (let n = 0; n < (ultimo === 'ORDINARIA' ? 2 : 3); n++) reinscritos.push(await f.alumno());
      const ordinarias: ConfirmarCarteraDto[] = [];
      for (let n = 0; n < (ultimo === 'ORDINARIA' ? 3 : 2); n++) {
        const numero = ++secuencia,
          a = await f.alta('/alumnos', {
            email: `mix${numero}_${ctx.sufijo}@example.invalid`,
            nombre: 'Alumno Nuevo',
            apellidoPaterno: 'Cohorte mixta',
            curp: `RPAA010101HDFLRN${String(numero).padStart(2, '0')}`,
            matricula: `MX${numero}${ctx.sufijo}`,
            plantelId: ctx.plantelId,
          });
        const { origenInscripcionId, ...resto } = reinscritos[0].payload;
        void origenInscripcionId;
        const payload = { ...resto, alumnoId: a.id },
          prev = await f.post('/cartera/previsualizar', payload, f.admin);
        expect(prev.response.status).toBe(201);
        ordinarias.push({ ...payload, cotizacion: prev.data.cotizacion, idempotencia: randomUUID(), confirmado: true });
      }
      const confirmaciones: ConfirmarPeriodoDto[] = [];
      for (const a of reinscritos) confirmaciones.push(await f.autorizar(a.payload));
      const confirmarOrdinaria = (n: number) => f.post('/cartera/confirmar', ordinarias[n], f.admin),
        confirmarReinscripcion = (n: number) =>
          f.post('/cartera/reinscripciones/confirmar', confirmaciones[n], f.admin);
      if (ultimo === 'ORDINARIA') {
        for (let n = 0; n < 2; n++) expect((await confirmarReinscripcion(n)).data.estado).toBe('PENDIENTE');
        for (let n = 0; n < 2; n++) expect((await confirmarOrdinaria(n)).data.estado).toBe('PENDIENTE');
        expect((await confirmarOrdinaria(2)).data.estado).toBe('ABIERTA');
      } else {
        for (let n = 0; n < 2; n++) expect((await confirmarOrdinaria(n)).data.estado).toBe('PENDIENTE');
        for (let n = 0; n < 2; n++) expect((await confirmarReinscripcion(n)).data.estado).toBe('PENDIENTE');
        const falla: EntitySubscriberInterface<Cargo> = {
          listenTo: () => Cargo,
          beforeInsert: (e) => {
            if (e.entity.cicloId === f.ciclo.id && e.entity.claveGeneracion?.startsWith('COLEGIATURA:'))
              throw Error('Fallo sintético de cargo ordinario en cohorte mixta');
          },
        };
        f.ds.subscribers.push(falla);
        try {
          expect((await confirmarReinscripcion(2)).response.status).toBe(500);
        } finally {
          f.ds.subscribers.splice(f.ds.subscribers.indexOf(falla), 1);
        }
        expect(await f.ds.getRepository(Cargo).countBy({ cicloId: f.ciclo.id })).toBe(0);
        expect(await f.ds.getRepository(Inscripcion).countBy({ grupoId: f.origenGrupo.id, estatus: 'ACTIVA' })).toBe(3);
        expect((await confirmarReinscripcion(2)).data.estado).toBe('CONFIRMADA');
      }
      const grupos = await f.ds.getRepository(Grupo).findBy({ periodoAcademicoId: f.destinoPeriodo.id });
      expect(grupos).toHaveLength(1);
      expect(await f.ds.getRepository(Inscripcion).countBy({ grupoId: grupos[0].id, estatus: 'ACTIVA' })).toBe(5);
      expect(await f.ds.getRepository(Cargo).countBy({ cicloId: f.ciclo.id })).toBe(5);
      expect(
        await f.ds.getRepository(ReinscripcionPeriodo).countBy({ cicloId: f.ciclo.id, estado: 'CONFIRMADA' }),
      ).toBe(reinscritos.length);
    },
  );
}
