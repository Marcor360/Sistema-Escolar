import { expect, it } from '@jest/globals';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import {
  Alumno,
  Docente,
  Calificacion,
  CicloEscolar,
  Grupo,
  GrupoMateria,
  Inscripcion,
  Materia,
  PeriodoCalificacion,
  Rol,
  Usuario,
  UsuarioPlantel,
} from '../../src/entities';
import { BoletaRespuesta } from '../../src/entities/boleta-respuesta.entity';
import { ContextoIntegracion } from './contexto';
import { curpFicticia } from './identidad-ficticia';
export function registrarBoletasFirmas(ctx: ContextoIntegracion) {
  it('boletas firmadas: tutor declarado, comentarios de 2000, permisos por materia, versiones e historial', async () => {
    const ds = ctx.dataSource;
    const passwordDocente='Boletas_Docente_42!', emailDocente=`bfm${ctx.sufijo}@example.invalid`;
    ctx.passwords.set(emailDocente,passwordDocente);
    const usuarioDocente=await ds.getRepository(Usuario).save({email:emailDocente,passwordHash:await bcrypt.hash(passwordDocente,4),nombre:'Docente',apellidoPaterno:'Boleta QA',roles:[await ds.getRepository(Rol).findOneByOrFail({clave:'MAESTRO'})]});
    const docenteRegistro=await ds.getRepository(Docente).save({usuarioId:usuarioDocente.id,numEmpleado:'BFM'+ctx.sufijo,estatus:'ACTIVO'});
    const ciclo = await ds
      .getRepository(CicloEscolar)
      .save({
        clave: 'BF' + ctx.sufijo,
        nombre: 'Boletas QA',
        fechaInicio: '2058-01-01',
        fechaFin: '2058-12-31',
        activo: false,
        estado: 'PREPARACION',
      });
    const grupo = await ds
      .getRepository(Grupo)
      .save({ plantelId: ctx.plantelId, cicloId: ciclo.id, nombre: 'BF' + ctx.sufijo, activo: true });
    const email = `bf${ctx.sufijo}@example.invalid`,
      password = 'Boletas_Ficticias_42!';
    ctx.passwords.set(email, password);
    const usuario = await ds
      .getRepository(Usuario)
      .save({
        email,
        passwordHash: await bcrypt.hash(password, 4),
        nombre: 'Alumno',
        apellidoPaterno: 'Boleta QA',
        roles: [await ds.getRepository(Rol).findOneByOrFail({ clave: 'ALUMNO' })],
        activacionPendiente: false,
      });
    const alumno = await ds
      .getRepository(Alumno)
      .save({ usuarioId: usuario.id, matricula: 'BF' + ctx.sufijo, plantelId: ctx.plantelId, curp: curpFicticia() });
    const insc = await ds
      .getRepository(Inscripcion)
      .save({ alumnoId: alumno.id, grupoId: grupo.id, estatus: 'ACTIVA' });
    const clases = [];
    for (let n = 0; n < 2; n++) {
      const materia = await ds
        .getRepository(Materia)
        .save({ clave: `BF${n}${ctx.sufijo}`, nombre: `Materia boleta ${n}`, creditos: 5, activo: true });
      const gm = await ds
        .getRepository(GrupoMateria)
        .save({
          grupoId: grupo.id,
          materiaId: materia.id,
          docenteId: n === 0 ? docenteRegistro.id : ctx.docenteFueraDeAlcanceId,
          regimenEvaluacion: 'CUATRO_PARCIALES_10',
        });
      clases.push(gm);
      await ds
        .getRepository(Calificacion)
        .save({ alumnoId: alumno.id, grupoMateriaId: gm.id, parcial: 0, calificacion: 8 + n, escalaMaxima: 10 });
      await ds
        .getRepository(PeriodoCalificacion)
        .save({ grupoMateriaId: gm.id, parcial: 0, estatus: n === 0 ? 'CERRADO' : 'ABIERTO' });
    }
    const token = await ctx.emitirToken(email),
      admin = await ctx.emitirToken((await ds.getRepository(Usuario).findOneByOrFail({ id: ctx.adminId })).email),
      maestro = await ctx.emitirToken(usuarioDocente.email);
    // Entrada web del alumno separada del acceso administrativo.
    const web=await ctx.api('/auth/login-alumno-web',{method:'POST',headers:{'x-portal':'WEB'},body:{email,password}});
    expect(web.response.status).toBe(201);expect(web.data.refreshToken).toBeUndefined();expect(web.response.headers.get('set-cookie')).toContain('HttpOnly');
    const previoOrigen=process.env.CORS_ORIGINS;process.env.CORS_ORIGINS='https://boletas-qa.example.invalid';
    try {const r=await ctx.api('/auth/refresh',{method:'POST',headers:{'x-portal':'WEB',origin:'https://boletas-qa.example.invalid',cookie:web.response.headers.get('set-cookie')!.split(';')[0]},body:{}});expect(r.response.status).toBe(201);expect(r.data.refreshToken).toBeUndefined();}
    finally {if(previoOrigen===undefined)delete process.env.CORS_ORIGINS;else process.env.CORS_ORIGINS=previoOrigen;}
    const ruta = `/boletas/inscripciones/${insc.id}`;
    const inicial = await ctx.api(ruta, { token });
    expect(inicial.response.status).toBe(200);
    expect(inicial.data.disponible).toBe(false);
    expect(inicial.data.materias).toEqual([]);
    const payload = {
      idempotencia: randomUUID(),
      versionHash: inicial.data.versionHash,
      estado: 'REVISION',
      firmanteNombre: 'Tutor Ficticio QA',
      firmanteTipo: 'TUTOR',
      comentario: 'Revisar el resultado de la materia.',
      confirmado: true,
    };
    expect((await ctx.api(ruta + '/responder', { method: 'POST', token, body: payload })).response.status).toBe(409);
    await ds
      .getRepository(PeriodoCalificacion)
      .update({ grupoMateriaId: clases[1].id, parcial: 0 }, { estatus: 'CERRADO' });
    const actual = await ctx.api(ruta, { token });
    payload.versionHash = actual.data.versionHash;
    expect(
      (
        await ctx.api(ruta + '/responder', {
          method: 'POST',
          token,
          body: { ...payload, comentario: 'a'.repeat(2001) },
        })
      ).response.status,
    ).toBe(400);
    expect(
      (await ctx.api(ruta + '/responder', { method: 'POST', token, body: { ...payload, comentario: ' ' } })).response
        .status,
    ).toBe(400);
    expect(
      (await ctx.api(ruta + '/responder', { method: 'POST', token, body: { ...payload, confirmado: false } })).response
        .status,
    ).toBe(400);
    const primera = await ctx.api(ruta + '/responder', { method: 'POST', token, body: payload });
    expect(primera.response.status).toBe(201);
    expect((await ctx.api(ruta + '/responder', { method: 'POST', token, body: payload })).data.id).toBe(
      primera.data.id,
    );
    expect(await ds.getRepository(BoletaRespuesta).countBy({ inscripcionId: insc.id })).toBe(1);
    const docente = await ctx.api(ruta, { token: maestro });
    expect(docente.data.materias).toHaveLength(1);
    expect(docente.data.materias[0].grupoMateriaId).toBe(clases[0].id);
    const comentario = {
      idempotencia: randomUUID(),
      versionHash: actual.data.versionHash,
      grupoMateriaId: clases[1].id,
      comentario: 'Respuesta del docente.',
    };
    expect(
      (await ctx.api(ruta + '/comentarios', { method: 'POST', token: maestro, body: comentario })).response.status,
    ).toBe(403);
    comentario.grupoMateriaId = clases[0].id;
    expect(
      (await ctx.api(ruta + '/comentarios', { method: 'POST', token: maestro, body: comentario })).response.status,
    ).toBe(201);
    const boleta = await ctx.api(`/reportes/formatos/mi-boleta?inscripcionId=${insc.id}`, { token });
    expect(boleta.data.filas[0].observaciones).toContain('Respuesta del docente');
    const aceptada = { ...payload, idempotencia: randomUUID(), estado: 'ACEPTADA', comentario: '' };
    expect((await ctx.api(ruta + '/responder', { method: 'POST', token, body: aceptada })).response.status).toBe(201);
    expect((await ctx.api(ruta, { token })).data.estado).toBe('ACEPTADA');
    await ds
      .getRepository(Calificacion)
      .update({ alumnoId: alumno.id, grupoMateriaId: clases[0].id, parcial: 0 }, { calificacion: 7 });
    const cambiada = await ctx.api(ruta, { token });
    expect(cambiada.data.estado).toBe('PENDIENTE_RESPUESTA');
    expect(cambiada.data.historial.every((e: { vigente: boolean }) => !e.vigente)).toBe(true);
    expect(
      (await ctx.api(ruta + '/responder', { method: 'POST', token, body: { ...aceptada, idempotencia: randomUUID() } }))
        .response.status,
    ).toBe(409);
    const listado = await ctx.api('/boletas/seguimiento?estado=ACEPTADA', { token: admin });
    expect(listado.data.datos.find((e: { inscripcionId: number }) => e.inscripcionId === insc.id)).toMatchObject({
      vigente: false,
    });
    expect((await ctx.api('/boletas/seguimiento', { token })).response.status).toBe(403);
    const ajeno = await ctx.emitirFinanzasB();
    expect((await ctx.api(ruta, { token: ajeno })).response.status).toBe(403);
    expect((await ctx.api(ruta + '/responder', { method: 'POST', token: admin, body: aceptada })).response.status).toBe(
      403,
    );
    const propio = await ctx.emitirToken(
      (await ds.getRepository(Usuario).findOneByOrFail({ id: ctx.alumnoUsuarioId })).email,
    );
    expect((await ctx.api(ruta, { token: propio })).response.status).toBe(403);
    // Director solo puede leer los planteles que tiene asignados.
    const rol = await ds.getRepository(Rol).findOneByOrFail({ clave: 'DIRECTOR' }),
      emailDir = `bfd${ctx.sufijo}@example.invalid`;
    ctx.passwords.set(emailDir, password);
    const director = await ds
      .getRepository(Usuario)
      .save({
        email: emailDir,
        passwordHash: await bcrypt.hash(password, 4),
        nombre: 'Director',
        apellidoPaterno: 'QA',
        roles: [rol],
      });
    await ds.getRepository(UsuarioPlantel).save({ usuarioId: director.id, plantelId: ctx.plantelId, activo: true });
    const td = await ctx.emitirToken(emailDir);
    expect((await ctx.api(ruta, { token: td })).response.status).toBe(200);
    expect((await ctx.api(`/boletas/seguimiento?plantelId=${ctx.otroPlantelId}`, { token: td })).response.status).toBe(
      403,
    );
  });
}
