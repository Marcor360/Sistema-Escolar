import { expect, it } from '@jest/globals';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { In } from 'typeorm';
import {
  Alumno,
  CarreraPlan,
  PeriodoAcademico,
  ProgramacionCobro,
  Cargo,
  CicloEscolar,
  ConceptoPago,
  Docente,
  Grupo,
  GrupoMateria,
  Inscripcion,
  Materia,
  NivelAcademico,
  Rol,
  Usuario,
  UsuarioPlantel,
} from '../../src/entities';
import { ContextoIntegracion } from './contexto';
export function registrarSeguimiento(ctx: ContextoIntegracion) {
  it('asistencias: solo profesor asignado captura, alumno propio y personal por plantel consultan; conserva historial y detecta conflicto', async () => {
    const ds = ctx.dataSource,
      fecha = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
    const ciclo = await ds
      .getRepository(CicloEscolar)
      .save({
        clave: 'SG' + ctx.sufijo,
        nombre: 'Ciclo seguimiento',
        fechaInicio: fecha.slice(0, 4) + '-01-01',
        fechaFin: fecha.slice(0, 4) + '-12-31',
        activo: true,
        estado: 'ACTIVO',
      });
    const nivel = await ds
      .getRepository(NivelAcademico)
      .save({ plantelId: ctx.plantelId, clave: 'SG' + ctx.sufijo, nombre: 'Nivel seguimiento', activo: true });
    const carrera = await ds
      .getRepository(CarreraPlan)
      .save({
        plantelId: ctx.plantelId,
        nivelId: nivel.id,
        clave: 'SP' + ctx.sufijo,
        nombre: 'Plan seguimiento',
        versionPlan: 'QA',
        activo: true,
      });
    const periodo = await ds
      .getRepository(PeriodoAcademico)
      .save({
        plantelId: ctx.plantelId,
        carreraId: carrera.id,
        cicloId: ciclo.id,
        clave: 'SG',
        nombre: 'Periodo seguimiento',
        tipo: 'ANUAL',
        numero: 1,
        activo: true,
      });
    const grupo = await ds
      .getRepository(Grupo)
      .save({
        plantelId: ctx.plantelId,
        cicloId: ciclo.id,
        nivelId: nivel.id,
        carreraId: carrera.id,
        periodoAcademicoId: periodo.id,
        nombre: 'Seguimiento ' + ctx.sufijo,
        activo: true,
      });
    const passwordHash = await bcrypt.hash('Integracion_Segura_42!', 4);
    const nuevo = async (clave: string, roles: string[]) => {
      const email=`sg_${clave}_${ctx.sufijo}@example.invalid`;
      ctx.passwords.set(email,'Integracion_Segura_42!');
      return ds
        .getRepository(Usuario)
        .save({
          email,
          nombre: 'Seguimiento',
          apellidoPaterno: clave,
          passwordHash,
          activo: true,
          roles: await ds.getRepository(Rol).findBy({ clave: In(roles) }),
        });
    };
    const du = await nuevo('docente', ['MAESTRO']),
      otro = await nuevo('otro', ['MAESTRO']);
    const docente = await ds
      .getRepository(Docente)
      .save({ usuarioId: du.id, numEmpleado: 'SG' + ctx.sufijo, estatus: 'ACTIVO' });
    await ds.getRepository(Docente).save({ usuarioId: otro.id, numEmpleado: 'SO' + ctx.sufijo, estatus: 'ACTIVO' });
    const materia = await ds
      .getRepository(Materia)
      .save({ clave: 'SG' + ctx.sufijo, nombre: 'Materia seguimiento', creditos: 0, activo: true });
    const clase = await ds
      .getRepository(GrupoMateria)
      .save({ grupoId: grupo.id, materiaId: materia.id, docenteId: docente.id });
    const au = await nuevo('alumno', ['ALUMNO']),
      bu = await nuevo('alumno2', ['ALUMNO']);
    const alumno = await ds
      .getRepository(Alumno)
      .save({ usuarioId: au.id, plantelId: ctx.plantelId, matricula: 'SG' + ctx.sufijo, estatus: 'ACTIVO' });
    const alumno2 = await ds
      .getRepository(Alumno)
      .save({ usuarioId: bu.id, plantelId: ctx.plantelId, matricula: 'SB' + ctx.sufijo, estatus: 'ACTIVO' });
    await ds.getRepository(Inscripcion).save([
      { alumnoId: alumno.id, grupoId: grupo.id, estatus: 'ACTIVA' },
      { alumnoId: alumno2.id, grupoId: grupo.id, estatus: 'ACTIVA' },
    ]);
    const adminBU=await nuevo('adminB',['ADMINISTRATIVO']);
    await ds.getRepository(UsuarioPlantel).save({usuarioId:adminBU.id,plantelId:ctx.otroPlantelId,activo:true});
    const adminB=await ctx.emitirToken(adminBU.email);
    const maestro = await ctx.emitirToken(du.email),
      ajeno = await ctx.emitirToken(otro.email),
      propio = await ctx.emitirToken(au.email);
    const admin = await ctx.emitirToken((await ds.getRepository(Usuario).findOneByOrFail({ id: ctx.adminId })).email),
      root = await ctx.emitirToken((await ds.getRepository(Usuario).findOneByOrFail({ id: ctx.superadminId })).email),
      fin = await ctx.emitirToken((await ds.getRepository(Usuario).findOneByOrFail({ id: ctx.finanzasId })).email);
    const lista = await ctx.api(`/asistencias/lista?grupoMateriaId=${clase.id}&desde=${fecha}`, { token: maestro });
    expect(lista.response.status).toBe(200);
    expect(lista.data.puedeCapturar).toBe(true);
    const datos = {
      grupoMateriaId: clase.id,
      fecha,
      revision: lista.data.revision,
      motivo: 'Captura de clase',
      registros: [
        { alumnoId: alumno.id, estado: 'PRESENTE' },
        { alumnoId: alumno2.id, estado: 'FALTA' },
      ],
    };
    for (const token of [admin, root, fin, ajeno, propio])
      expect((await ctx.api('/asistencias', { method: 'POST', token, body: datos })).response.status).toBe(403);
    expect((await ctx.api('/asistencias', { method: 'POST', token: maestro, body: datos })).response.status).toBe(201);
    expect((await ctx.api('/asistencias', { method: 'POST', token: maestro, body: datos })).response.status).toBe(409);
    const consulta = `?desde=${fecha}&hasta=${fecha}&grupoMateriaId=${clase.id}`;
    const mias = await ctx.api('/asistencias' + consulta, { token: propio });
    expect(mias.response.status).toBe(200);
    expect(mias.data.datos).toHaveLength(1);
    expect(Number(mias.data.datos[0].alumnoId)).toBe(alumno.id);
    expect(
      (await ctx.api('/asistencias' + consulta + '&alumnoId=' + alumno2.id, { token: propio })).data.datos,
    ).toHaveLength(0);
    expect((await ctx.api('/asistencias' + consulta, { token: admin })).data.datos).toHaveLength(2);
    expect((await ctx.api('/asistencias'+consulta,{token:adminB})).data.datos).toHaveLength(0);
    expect((await ctx.api(`/asistencias/lista?grupoMateriaId=${clase.id}&desde=${fecha}`,{token:adminB})).response.status).toBe(403);
    expect((await ctx.api('/asistencias' + consulta, { token: root })).data.datos).toHaveLength(2);
    expect((await ctx.api('/asistencias' + consulta, { token: await ctx.emitirFinanzasB() })).response.status).toBe(
      403,
    );
    expect(
      (await ctx.api('/asistencias/' + mias.data.datos[0].id + '/historial', { token: maestro })).data,
    ).toHaveLength(1);
    const fuera = await ctx.api(`/asistencias/lista?grupoMateriaId=${clase.id}&desde=${fecha}`, { token: ajeno });
    expect(fuera.response.status).toBe(403);
    const tramite = await ctx.api('/seguimiento/tramites', {
      method: 'POST',
      token: propio,
      body: { clave: randomUUID(), tipo: 'CONSTANCIA', detalle: 'Solicito constancia de estudios' },
    });
    expect(tramite.response.status).toBe(201);
    expect(
      (
        await ctx.api('/seguimiento/tramites/' + tramite.data.id + '/historial', {
          token: await ctx.emitirToken(bu.email),
        })
      ).response.status,
    ).toBe(403);
    expect(
      (
        await ctx.api('/seguimiento/tramites/' + tramite.data.id, {
          method: 'PATCH',
          token: admin,
          body: {
            revision: 1,
            estado: 'EN_REVISION',
            responsableId: ctx.adminId,
            mensaje: 'Solicitud asignada para revisión',
          },
        })
      ).response.status,
    ).toBe(200);
    expect(
      (
        await ctx.api('/seguimiento/tramites/' + tramite.data.id, {
          method: 'PATCH',
          token: propio,
          body: { revision: 2, estado: 'RESUELTO', mensaje: 'Intento no permitido' },
        })
      ).response.status,
    ).toBe(403);
    expect((await ctx.api('/seguimiento/calidad', { token: admin })).response.status).toBe(200);
    expect((await ctx.api('/seguimiento/pendientes', { token: propio })).response.status).toBe(200);
    expect((await ctx.api('/seguimiento/pendientes', { token: maestro })).response.status).toBe(200);
    expect(
      (
        await ctx.api('/seguimiento/preferencias', {
          method: 'PATCH',
          token: propio,
          body: { preferencias: [{ tipo: 'ACADEMICA', push: false, correo: false }] },
        })
      ).response.status,
    ).toBe(200);
    expect(
      (await ctx.api('/seguimiento/preferencias', { token: propio })).data.find(
        (p: { tipo: string }) => p.tipo === 'ACADEMICA',
      ).push,
    ).toBe(false);
    const sesiones = await ctx.api('/seguimiento/sesiones', { token: propio });
    expect(sesiones.response.status).toBe(200);
    expect(sesiones.data.length).toBeGreaterThan(0);
    expect(JSON.stringify(sesiones.data)).not.toContain('refreshHash');
    const contenido = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:sg-${ctx.sufijo}\r\nSUMMARY:Evento importado\r\nDTSTART;VALUE=DATE:${fecha.replace(/-/g, '')}\r\nEND:VEVENT\r\nEND:VCALENDAR`;
    const ics = { cicloId: ciclo.id, nivelId: nivel.id, plantelId: ctx.plantelId, audiencia: 'ACADEMICA', contenido };
    expect(
      (await ctx.api('/calendario/ics/preview', { method: 'POST', token: admin, body: ics })).response.status,
    ).toBe(201);
    expect((await ctx.api('/calendario/ics', { method: 'POST', token: admin, body: ics })).data.creados).toBe(1);
    expect((await ctx.api('/calendario/ics', { method: 'POST', token: admin, body: ics })).data.creados).toBe(0);
    const concepto = await ds.getRepository(ConceptoPago).findOneByOrFail({ activo: true });
    const cargo = await ds
      .getRepository((await import('../../src/entities')).Cargo)
      .save({
        plantelId: ctx.plantelId,
        alumnoId: alumno.id,
        conceptoId: concepto.id,
        descripcion: 'Conciliación de prueba',
        cicloId:ciclo.id,
        monto: 100,
        descuento: 0,
        recargo: 0,
        estatus: 'PENDIENTE',
      });
    const banco = {
      plantelId: ctx.plantelId,
      cuenta: 'qa',
      movimientos: [
        { folio: 'SG' + ctx.sufijo, referencia: 'IUA-C' + String(cargo.id).padStart(10, '0'), fecha, monto: 10 },
      ],
    };
    expect(
      (await ctx.api('/seguimiento/movimientos/preview', { method: 'POST', token: fin, body: banco })).response.status,
    ).toBe(201);
    expect(
      (await ctx.api('/seguimiento/movimientos', { method: 'POST', token: fin, body: banco })).response.status,
    ).toBe(201);
    const movimientos = await ctx.api('/seguimiento/movimientos', { token: fin }),
      mov = movimientos.data.find((m: { folio: string }) => m.folio === 'SG' + ctx.sufijo);
    expect(mov).toBeTruthy();
    const aplicar = () =>
      ctx.api('/seguimiento/movimientos/' + mov.id + '/aplicar', {
        method: 'POST',
        token: fin,
        body: { cargoId: cargo.id },
      });
    const pago = await aplicar();
    expect(pago.response.status).toBe(201);
    expect((await aplicar()).data.pagoId).toBe(pago.data.pagoId);

    const consultaGrafica=`/analitica/comparativas?cicloId=${ciclo.id}&desde=${fecha}&hasta=${fecha}`;
    const graficas=await ctx.api(consultaGrafica,{token:fin});expect(graficas.response.status).toBe(200);
    expect(graficas.data.financiero.porPlantel.reduce((n:number,p:{valor:number})=>n+p.valor,0)).toBe(10);
    expect(graficas.data.financiero.porCarrera.find((p:{id:string})=>p.id==='sin-asignar').valor).toBe(10);
    expect(graficas.data.inscripciones).toBeUndefined();
    const academicas=await ctx.api(consultaGrafica,{token:admin});expect(academicas.response.status).toBe(200);expect(academicas.data.inscripciones.porCarrera.reduce((n:number,p:{valor:number})=>n+p.valor,0)).toBe(2);
    expect((await ctx.api(consultaGrafica,{token:propio})).response.status).toBe(403);
    const maestroGraficas=await ctx.api(consultaGrafica,{token:maestro});expect(maestroGraficas.response.status).toBe(200);expect(maestroGraficas.data.financiero).toBeUndefined();
    const plan=await ds.getRepository(ProgramacionCobro).save({idempotencia:randomUUID(),peticionHash:'a'.repeat(64),alumnoId:alumno.id,plantelId:ctx.plantelId,cicloId:ciclo.id,periodoAcademicoId:periodo.id,conceptoId:concepto.id,modalidad:'ADICIONAL',total:100,cuotas:[],creadoPorId:ctx.adminId});
    await ds.getRepository(Cargo).update(cargo.id,{claveGeneracion:'PROGRAMACION:'+plan.id+':1'});
    const vinculadas=await ctx.api(consultaGrafica,{token:fin});expect(vinculadas.data.financiero.porCarrera.find((p:{id:string})=>p.id===String(carrera.id)).valor).toBe(10);
    const grupoExtra=await ds.getRepository(Grupo).save({plantelId:ctx.plantelId,cicloId:ciclo.id,nivelId:nivel.id,carreraId:carrera.id,periodoAcademicoId:periodo.id,nombre:'Otra inscripción '+ctx.sufijo,activo:true});
    await ds.getRepository(Inscripcion).save({alumnoId:alumno.id,grupoId:grupoExtra.id,estatus:'ACTIVA'});
    const distintas=await ctx.api(consultaGrafica,{token:admin});expect(distintas.data.inscripciones.porCarrera.reduce((n:number,p:{valor:number})=>n+p.valor,0)).toBe(2);

    expect((await ctx.api(consultaGrafica+`&plantelId=${ctx.otroPlantelId}`,{token:fin})).response.status).toBe(403);
    const correccion={alumnoId:alumno.id,telefono:'5512345678'};
    const preview=await ctx.api('/seguimiento/calidad/preview',{method:'POST',token:admin,body:correccion});expect(preview.response.status).toBe(201);
    expect((await ctx.api('/seguimiento/calidad/confirmar',{method:'POST',token:admin,body:{...correccion,telefono:'5599999999',revision:preview.data.revision}})).response.status).toBe(409);
    expect((await ctx.api('/seguimiento/calidad/confirmar',{method:'POST',token:admin,body:{...correccion,revision:preview.data.revision}})).response.status).toBe(201);
    expect((await ctx.api('/seguimiento/calidad/confirmar',{method:'POST',token:admin,body:{...correccion,revision:preview.data.revision}})).response.status).toBe(409);
    expect((await ctx.api('/seguimiento/calidad/preview',{method:'POST',token:adminB,body:correccion})).response.status).toBe(403);
  });
}
