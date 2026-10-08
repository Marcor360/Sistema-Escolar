import { ContextoIntegracion } from './contexto';
import { PushService } from '../../src/notificaciones/push.service';
import { NotificacionesService } from '../../src/notificaciones/notificaciones.service';
import { expect, it, jest } from '@jest/globals';
import * as ExcelJS from 'exceljs';
import { AuthService } from '../../src/auth/auth.service';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { Alumno, Grupo, GrupoMateria, Inscripcion, PushDispositivo, PushEnvio, Docente, Materia, Notificacion, Plantel, Rol, Usuario, UsuarioPlantel } from '../../src/entities';
export const casos_identidad: Record<number, (ctx: ContextoIntegracion) => void> = {
  2: (ctx) => {
it('autentica y limita el detalle de planteles a las asignaciones del usuario', async () => {
    const password = 'Integracion_Segura_42!';
    const admin = await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.adminId });
    const inicioSesion = await ctx.api('/auth/login', {
      method: 'POST', headers: { 'x-portal': 'WEB' }, body: { email: admin.email, password },
    });
    expect(inicioSesion.response.status).toBe(201);
    const token = inicioSesion.data.accessToken as string;

    const perfil = await ctx.api('/auth/me', { token });
    expect(perfil.response.status).toBe(200);
    expect(perfil.data.email).toBe(admin.email);

    const mios = await ctx.api('/planteles/mios', { token });
    expect(mios.response.status).toBe(200);
    expect(mios.data.map((p: Plantel) => p.id)).toContain(ctx.plantelId);
    expect(mios.data.map((p: Plantel) => p.id)).not.toContain(ctx.otroPlantelId);

    const fueraDeAlcance = await ctx.api(`/planteles/${ctx.otroPlantelId}`, { token });
    expect(fueraDeAlcance.response.status).toBe(403);
  });
  },
  3: (ctx) => {
it('no serializa hashes en login, perfil, alumnos, docentes ni usuarios', async () => {
    const admin = await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.adminId });
    const superadmin = await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.superadminId });
    const tokenAdmin = await ctx.emitirToken(admin.email);
    const tokenRoot = await ctx.emitirToken(superadmin.email);
    const inicioSesion = await ctx.api('/auth/login', {
      method: 'POST', headers: { 'x-portal': 'WEB' },
      body: { email: admin.email, password: 'Integracion_Segura_42!' },
    });
    expect(inicioSesion.response.status).toBe(201);
    const nuevoDocente = await ctx.api('/docentes', {
      method: 'POST', token: tokenAdmin,
      body: {
        email: `docente_visible_${ctx.sufijo}@example.invalid`, password: 'Integracion_Segura_42!',
        nombre: 'Docente', apellidoPaterno: 'Visible', numEmpleado: `V${ctx.sufijo}`, plantelIds: [ctx.plantelId],
      },
    });
    expect(nuevoDocente.response.status).toBe(201);

    const respuestas = await Promise.all([
      ctx.api('/alumnos', { token: tokenAdmin }),
      ctx.api(`/alumnos/${ctx.alumnoId}`, { token: tokenAdmin }),
      ctx.api('/docentes', { token: tokenAdmin }),
      ctx.api(`/docentes/${nuevoDocente.data.id}`, { token: tokenAdmin }),
      ctx.api('/usuarios', { token: tokenRoot }),
      ctx.api(`/usuarios/${ctx.adminId}`, { token: tokenRoot }),
      ctx.api('/auth/me', { token: tokenAdmin }),
      ctx.api(`/finanzas/ordenes/${ctx.ordenId}`, { token: tokenAdmin }),
      ctx.api('/finanzas/pagos', { token: tokenAdmin }),
    ]);
    for (const respuesta of respuestas) expect(respuesta.response.status).toBe(200);
    for (const respuesta of respuestas) {
      expect(JSON.stringify(respuesta.data)).not.toContain('passwordHash');
    }
    expect(JSON.stringify(inicioSesion.data)).not.toContain('passwordHash');
    expect(JSON.stringify(nuevoDocente.data)).not.toContain('passwordHash');
  });
  },
  4: (ctx) => {
it('rechaza consultar, editar o dar de baja docentes fuera del alcance del plantel', async () => {
    const admin = await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.adminId });
    const token = await ctx.emitirToken(admin.email);

    const detalle = await ctx.api(`/docentes/${ctx.docenteFueraDeAlcanceId}`, { token });
    const edicion = await ctx.api(`/docentes/${ctx.docenteFueraDeAlcanceId}`, {
      method: 'PATCH', token, body: { especialidad: 'Cambio no autorizado' },
    });
    const baja = await ctx.api(`/docentes/${ctx.docenteFueraDeAlcanceId}`, { method: 'DELETE', token });

    expect(detalle.response.status).toBe(403);
    expect(edicion.response.status).toBe(403);
    expect(baja.response.status).toBe(403);
  });
  },
  5: (ctx) => {
it('ADMINISTRATIVO y FINANZAS no acceden a alumnos de otro plantel', async () => {
    const admin = await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.adminId });
    const token = await ctx.emitirToken(admin.email);
    const usuarioOtroPlantel = await ctx.dataSource.getRepository(Usuario).save(ctx.dataSource.getRepository(Usuario).create({
      email: `alumno_fuera_${ctx.sufijo}@example.invalid`, passwordHash: await bcrypt.hash('Integracion_Segura_42!', 4),
      nombre: 'Alumno', apellidoPaterno: 'Fuera', activo: true,
      roles: [await ctx.dataSource.getRepository(Rol).findOneByOrFail({ clave: 'ALUMNO' })],
    }));
    const alumnoFuera = await ctx.dataSource.getRepository(Alumno).save(ctx.dataSource.getRepository(Alumno).create({
      usuarioId: usuarioOtroPlantel.id, plantelId: ctx.otroPlantelId, matricula: `F${ctx.sufijo}`,
    }));

    const [listado, detalle, estadoCuenta, pagos] = await Promise.all([
      ctx.api('/alumnos', { token }),
      ctx.api(`/alumnos/${alumnoFuera.id}`, { token }),
      ctx.api(`/finanzas/alumnos/${alumnoFuera.id}/estado-cuenta`, { token }),
      ctx.api(`/finanzas/pagos?alumnoId=${alumnoFuera.id}`, { token }),
    ]);
    expect(listado.response.status).toBe(200);
    expect(listado.data.datos.map((a: Alumno) => a.id)).not.toContain(alumnoFuera.id);
    expect(detalle.response.status).toBe(403);
    expect(estadoCuenta.response.status).toBe(403);
    expect(pagos.response.status).toBe(200);
    expect(pagos.data.datos).toEqual([]);
  });
  },
  6: (ctx) => {
it('FINANZAS recibe los datos mínimos del alumno para operar su cuenta', async () => {
    const finanzas = await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.finanzasId });
    const token = await ctx.emitirToken(finanzas.email);
    const [perfil, estado] = await Promise.all([
      ctx.api(`/alumnos/${ctx.alumnoId}`, { token }),
      ctx.api(`/finanzas/alumnos/${ctx.alumnoId}/estado-cuenta`, { token }),
    ]);
    expect(perfil.response.status).toBe(200);
    expect(estado.response.status).toBe(200);
    for (const respuesta of [perfil, estado]) {
      expect(JSON.stringify(respuesta.data)).not.toContain(`CURP${ctx.sufijo}`);
      expect(JSON.stringify(respuesta.data)).not.toContain('Tutor Privado');
      expect(JSON.stringify(respuesta.data)).not.toContain('5550000000');
      expect(JSON.stringify(respuesta.data)).not.toContain('Domicilio privado');
    }
  });
  },
  7: (ctx) => {
it('revierte la cuenta si falla el alta del expediente relacionado', async () => {
    const superadmin = await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.superadminId });
    const token = await ctx.emitirToken(superadmin.email);
    const email = `rollback_${ctx.sufijo}@example.invalid`;
    const resultado = await ctx.api('/alumnos', {
      method: 'POST', token,
      body: {
        email, password: 'Integracion_Segura_42!', nombre: 'Rollback', apellidoPaterno: 'Prueba',
        matricula: `R${ctx.sufijo}`, plantelId: 2147483000,
      },
    });

    expect(resultado.response.status).toBeGreaterThanOrEqual(400);
    expect(await ctx.dataSource.getRepository(Usuario).findOneBy({ email })).toBeNull();
  });
  },
  19: (ctx) => {
it('revoca JWT anteriores tras bajas de alumno/docente y cambio de contraseña', async () => {
    const admin = await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.adminId });
    const tokenAdmin = await ctx.emitirToken(admin.email);
    const altaAlumno = await ctx.api('/alumnos', {
      method: 'POST', token: tokenAdmin,
      body: {
        email: `baja_alumno_${ctx.sufijo}@example.invalid`, password: 'Integracion_Segura_42!',
        nombre: 'Baja', apellidoPaterno: 'Alumno', matricula: `B${ctx.sufijo}`, plantelId: ctx.plantelId,
      },
    });
    const tokenAlumno = await ctx.emitirToken(`baja_alumno_${ctx.sufijo}@example.invalid`);
    const bajaAlumno = await ctx.api(`/alumnos/${altaAlumno.data.id}`, { method: 'DELETE', token: tokenAdmin });
    expect(bajaAlumno.response.status).toBe(200);
    expect((await ctx.api('/auth/me', { token: tokenAlumno })).response.status).toBe(401);

    const altaDocente = await ctx.api('/docentes', {
      method: 'POST', token: tokenAdmin,
      body: {
        email: `baja_docente_${ctx.sufijo}@example.invalid`, password: 'Integracion_Segura_42!',
        nombre: 'Baja', apellidoPaterno: 'Docente', numEmpleado: `BD${ctx.sufijo}`, plantelIds: [ctx.plantelId],
      },
    });
    const tokenDocente = await ctx.emitirToken(`baja_docente_${ctx.sufijo}@example.invalid`);
    const bajaDocente = await ctx.api(`/docentes/${altaDocente.data.id}`, { method: 'DELETE', token: tokenAdmin });
    expect(bajaDocente.response.status).toBe(200);
    expect((await ctx.api('/auth/me', { token: tokenDocente })).response.status).toBe(401);

    const rolesRepo = ctx.dataSource.getRepository(Rol);
    const usuarioTemporal = await ctx.dataSource.getRepository(Usuario).save(ctx.dataSource.getRepository(Usuario).create({
      email: `revocable_${ctx.sufijo}@example.invalid`, passwordHash: await bcrypt.hash('Integracion_Segura_42!', 4),
      nombre: 'Revocable', apellidoPaterno: 'Sesión', activo: true,
      roles: [await rolesRepo.findOneByOrFail({ clave: 'ADMINISTRATIVO' })],
    }));
    await ctx.dataSource.getRepository(UsuarioPlantel).save(ctx.dataSource.getRepository(UsuarioPlantel).create({
      usuarioId: usuarioTemporal.id, plantelId: ctx.plantelId, activo: true,
    }));
    const tokenAnterior = await ctx.emitirToken(usuarioTemporal.email);
    const cambio = await ctx.api('/auth/cambiar-password', {
      method: 'POST', token: tokenAnterior,
      body: { actual: 'Integracion_Segura_42!', nueva: 'Integracion_Nueva_42!' },
    });
    expect(cambio.response.status).toBe(201);
    expect((await ctx.api('/auth/me', { token: tokenAnterior })).response.status).toBe(401);
  });
  },
  20: (ctx) => {
it('revoca el JWT al cerrar sesión y permite un nuevo inicio', async () => {
    const admin = await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.adminId });
    const token = await ctx.emitirToken(admin.email);
    expect((await ctx.api('/auth/me', { token })).response.status).toBe(200);

    const cierre = await ctx.api('/auth/logout', { method: 'POST', token });
    expect(cierre.response.status).toBe(201);
    expect((await ctx.api('/auth/me', { token })).response.status).toBe(401);
    expect((await ctx.api('/auth/logout', { method: 'POST', token })).response.status).toBe(401);

    const nuevo = await ctx.emitirToken(admin.email);
    expect((await ctx.api('/auth/me', { token: nuevo })).response.status).toBe(200);
  });
  },
  22: (ctx) => {
it('bloquea PATCH de estado/plantel, conserva bajas/egresos y completa transferencias', async () => {
    const token = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.superadminId })).email);
    const grupo = await ctx.dataSource.getRepository(Grupo).findOneByOrFail({ nombre: `G${ctx.sufijo}`, plantelId: ctx.plantelId });
    for (const accion of ['baja', 'egreso', 'transferencia']) {
      const alta = await ctx.api('/alumnos', { method: 'POST', token, body: {
        nombre: 'Transición', apellidoPaterno: accion, matricula: `T${accion.slice(0, 2)}${ctx.sufijo}`,
        email: `${accion}_${ctx.sufijo}@example.invalid`, password: 'Integracion_Segura_42!', plantelId: ctx.plantelId,
      } }); expect(alta.response.status).toBe(201);
      const id = alta.data.id; const usuarioId = alta.data.usuarioId;
      const movil = await ctx.emitirToken(`${accion}_${ctx.sufijo}@example.invalid`);
      expect((await ctx.api(`/academico/grupos/${grupo.id}/alumnos`, { method: 'POST', token, body: { alumnoId: id } })).response.status).toBe(201);
      expect((await ctx.api(`/alumnos/${id}`, { method: 'PATCH', token, body: { estatus: 'BAJA' } })).response.status).toBe(400);
      expect((await ctx.api(`/alumnos/${id}`, { method: 'PATCH', token, body: { plantelId: ctx.otroPlantelId } })).response.status).toBe(400);
      const resultado = await ctx.api(`/alumnos/${id}/${accion}`, { method: 'POST', token,
        ...(accion === 'transferencia' ? { body: { plantelId: ctx.otroPlantelId } } : {}) });
      expect(resultado.response.status).toBe(201);
      expect(await ctx.dataSource.getRepository(Inscripcion).countBy({ alumnoId: id, estatus: 'ACTIVA' })).toBe(0);
      const expediente = await ctx.dataSource.getRepository(Alumno).findOneByOrFail({ id });
      const cuenta = await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: usuarioId });
      if (accion === 'transferencia') { expect(expediente.plantelId).toBe(ctx.otroPlantelId); expect(cuenta.activo).toBe(true); }
      else {
        if (accion === 'egreso') {
          expect((await ctx.api(`/alumnos/${id}/baja`, { method: 'POST', token })).response.status).toBe(409);
          expect((await ctx.api(`/alumnos/${id}/reactivacion`, { method: 'POST', token, body: { motivo: 'Intento inválido' } })).response.status).toBe(409);
        }
        expect(expediente.estatus).toBe(accion === 'baja' ? 'BAJA' : 'EGRESADO'); expect(cuenta.activo).toBe(false);
        expect((await ctx.api('/auth/me', { token: movil })).response.status).toBe(401);
      }
    }
  });
  },
  25: (ctx) => {
it('rota refresh, detecta reutilización y revoca solamente la sesión afectada', async () => {
    const email = (await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.alumnoUsuarioId })).email;
    const auth = ctx.app.get(AuthService);
    const primera = await auth.login(email, 'Integracion_Segura_42!', 'MOVIL');
    const segunda = await auth.login(email, 'Integracion_Segura_42!', 'MOVIL');
    const rotada = await auth.refresh(primera.refreshToken, 'MOVIL');
    expect(rotada.refreshToken).not.toBe(primera.refreshToken);
    await expect(auth.refresh(primera.refreshToken, 'MOVIL')).rejects.toThrow('ya no está activa');
    expect((await ctx.api('/auth/me', { token: rotada.accessToken })).response.status).toBe(401);
    expect((await ctx.api('/auth/me', { token: segunda.accessToken })).response.status).toBe(200);
    await expect(auth.refresh(segunda.refreshToken, 'WEB')).rejects.toThrow('Refresh inválido');
    expect((await ctx.api('/auth/logout', { method: 'POST', token: segunda.accessToken })).response.status).toBe(201);
    await expect(auth.refresh(segunda.refreshToken, 'MOVIL')).rejects.toThrow('ya no está activa');
  });
  },
  26: (ctx) => {
it('desactiva al docente y deja sus clases disponibles para reasignación', async () => {
    const token = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.adminId })).email);
    const docente = await ctx.dataSource.getRepository(Docente).findOneOrFail({ where: { usuario: { email: `maestro_b_${ctx.sufijo}@example.invalid` } } });
    const tokenMaestro = await ctx.emitirToken(docente.usuario.email);
    const clase = await ctx.dataSource.getRepository(GrupoMateria).findOneByOrFail({ id: ctx.grupoMateriaIdMaestro });
    const anterior = clase.docenteId!;
    expect((await ctx.api(`/academico/grupo-materias/${clase.id}/docente/${docente.id}`, { method: 'PATCH', token })).response.status).toBe(200);
    expect((await ctx.dataSource.getRepository(GrupoMateria).findOneByOrFail({ id: clase.id })).docenteId).toBe(docente.id);
    expect((await ctx.api(`/academico/grupo-materias/${clase.id}/docente/${anterior}`, { method: 'PATCH', token })).response.status).toBe(200);
    expect((await ctx.api(`/docentes/${docente.id}`, { method: 'PATCH', token, body: { estatus: 'BAJA' } })).response.status).toBe(400);
    expect((await ctx.api(`/docentes/${docente.id}/baja`, { method: 'POST', token })).response.status).toBe(201);
    expect((await ctx.dataSource.getRepository(Docente).findOneByOrFail({ id: docente.id })).estatus).toBe('BAJA');
    expect((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: docente.usuarioId })).activo).toBe(false);
    expect(await ctx.dataSource.getRepository(UsuarioPlantel).countBy({ usuarioId: docente.usuarioId, activo: true })).toBe(0);
    expect(await ctx.dataSource.getRepository(GrupoMateria).countBy({ docenteId: docente.id })).toBe(0);
    expect((await ctx.api('/auth/me', { token: tokenMaestro })).response.status).toBe(401);
    expect((await ctx.api(`/academico/grupo-materias/${ctx.grupoMateriaIdMaestro}/docente/${docente.id}`, { method: 'PATCH', token })).response.status).toBe(409);
    const inactiva = await ctx.dataSource.getRepository(Materia).save(ctx.dataSource.getRepository(Materia).create({ clave: `INA${ctx.sufijo}`, nombre: 'Materia inactiva', activo: false }));
    const gm = await ctx.dataSource.getRepository(GrupoMateria).findOneByOrFail({ id: ctx.grupoMateriaIdMaestro });
    expect((await ctx.api(`/academico/grupos/${gm.grupoId}/materias`, { method: 'POST', token, body: { materiaId: inactiva.id } })).response.status).toBe(409);
  });
  },
  27: (ctx) => {
it('obliga cambio inicial y evita personal sin plantel o roles de expediente sin expediente', async () => {
    const token = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.superadminId })).email);
    const datos = { email: `nuevo_staff_${ctx.sufijo}@example.invalid`, nombre: 'Personal', apellidoPaterno: 'Nuevo', password: 'Integracion_Segura_42!' };
    for (const rol of ['ALUMNO', 'MAESTRO', 'FINANZAS']) expect((await ctx.api('/usuarios', { method: 'POST', token, body: { ...datos, roles: [rol] } })).response.status).toBe(409);
    const alta = await ctx.api('/usuarios', { method: 'POST', token, body: { ...datos, roles: ['ADMINISTRATIVO'], plantelIds: [ctx.plantelId] } });
    expect(alta.response.status).toBe(201);
    const auth = ctx.app.get(AuthService);
    const temporal = await auth.login(datos.email, datos.password, 'WEB');
    expect(temporal.usuario.passwordChangeRequired).toBe(true);
    expect((await ctx.api('/alumnos', { token: temporal.accessToken })).response.status).toBe(403);
    expect((await ctx.api('/auth/cambiar-password', { method: 'POST', token: temporal.accessToken,
      body: { actual: datos.password, nueva: 'Nueva_Institucional_42!' } })).response.status).toBe(201);
    expect((await ctx.api('/auth/me', { token: temporal.accessToken })).response.status).toBe(401);
    const definitiva = await auth.login(datos.email, 'Nueva_Institucional_42!', 'WEB');
    expect((await ctx.api('/alumnos', { token: definitiva.accessToken })).response.status).toBe(200);
  });
  },
  31: (ctx) => {
it('push registra por sesión/dispositivo, deduplica y no admite personal', async () => {
    const alumno = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.alumnoUsuarioId })).email);
    const admin = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.adminId })).email);
    const instalacionId = randomUUID(); const token = `ExponentPushToken[${ctx.sufijo}]`;
    const registro = await ctx.api('/notificaciones/push/dispositivos', { method: 'POST', token: alumno, body: { instalacionId, token } });
    expect(registro.response.status).toBe(201); expect(registro.data.registrado).toBe(true);
    expect((await ctx.api('/notificaciones/push/dispositivos', { method: 'POST', token: alumno, body: { instalacionId, token } })).response.status).toBe(201);
    expect(await ctx.dataSource.getRepository(PushDispositivo).countBy({ token, activo: true })).toBe(1);
    expect((await ctx.api('/notificaciones/push/dispositivos', { method: 'POST', token: admin, body: { instalacionId: randomUUID(), token: `ExponentPushToken[admin${ctx.sufijo}]` } })).response.status).toBe(403);
    const notificacion = await ctx.app.get(NotificacionesService).crear(ctx.alumnoUsuarioId, 'Aviso público', 'Disponible en la app');
    await ctx.app.get(PushService).encolar(notificacion); await ctx.app.get(PushService).encolar(notificacion);
    expect(await ctx.dataSource.getRepository(PushEnvio).countBy({ notificacionId: notificacion.id })).toBe(1);
    expect((await ctx.api(`/notificaciones/push/dispositivos/${instalacionId}`, { method: 'DELETE', token: alumno })).response.status).toBe(200);
    expect(await ctx.dataSource.getRepository(PushDispositivo).countBy({ token, activo: true })).toBe(0);
  });
  },
  34: (ctx) => {
it('reactiva alumno sin restaurar inscripciones y docente sin restaurar clases', async () => {
    const admin = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.adminId })).email);
    const alumno = await ctx.api('/alumnos', { method: 'POST', token: admin, body: { email: `reactiva_${ctx.sufijo}@example.invalid`, password: 'Integracion_Segura_42!', nombre: 'Reactiva', apellidoPaterno: 'Prueba', matricula: `RA${ctx.sufijo}`, plantelId: ctx.plantelId } });
    const clase = await ctx.dataSource.getRepository(GrupoMateria).findOneByOrFail({ id: ctx.grupoMateriaIdMaestro });
    expect((await ctx.api(`/academico/grupos/${clase.grupoId}/alumnos`, { method: 'POST', token: admin, body: { alumnoId: alumno.data.id } })).response.status).toBe(201);
    expect((await ctx.api(`/alumnos/${alumno.data.id}/baja`, { method: 'POST', token: admin })).response.status).toBe(201);
    const reactivado = await ctx.api(`/alumnos/${alumno.data.id}/reactivacion`, { method: 'POST', token: admin, body: { motivo: 'Retorno autorizado' } }); expect(reactivado.response.status).toBe(201);
    const expediente = await ctx.dataSource.getRepository(Alumno).findOneByOrFail({ id: alumno.data.id }); expect(expediente.estatus).toBe('ACTIVO'); expect(expediente.usuario.activo).toBe(true);
    expect(await ctx.dataSource.getRepository(Inscripcion).countBy({ alumnoId: expediente.id, estatus: 'ACTIVA' })).toBe(0);
    const docente = await ctx.dataSource.getRepository(Docente).findOneOrFail({ where: { usuario: { email: `maestro_b_${ctx.sufijo}@example.invalid` } } });
    expect(docente.estatus).toBe('BAJA');
    expect((await ctx.api(`/docentes/${docente.id}/reactivacion`, { method: 'POST', token: admin, body: { plantelIds: [ctx.plantelId], motivo: 'Retorno autorizado' } })).response.status).toBe(201);
    expect((await ctx.dataSource.getRepository(Docente).findOneByOrFail({ id: docente.id })).usuario.activo).toBe(true);
    expect(await ctx.dataSource.getRepository(GrupoMateria).countBy({ docenteId: docente.id })).toBe(0);
    expect(await ctx.dataSource.getRepository(UsuarioPlantel).countBy({ usuarioId: docente.usuarioId, activo: true })).toBe(1);
  });
  },
  38: (ctx) => {
it('gestiona personal con planteles explícitos y revoca la sesión después de corregir el alcance', async () => {
    const root = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.superadminId })).email);
    const alta = await ctx.api('/usuarios', { method: 'POST', token: root, body: { email: `personal_edit_${ctx.sufijo}@example.invalid`, password: 'Integracion_Segura_42!', nombre: 'Personal', apellidoPaterno: 'Corregible', roles: ['FINANZAS'], plantelIds: [ctx.plantelId] } }); expect(alta.response.status).toBe(201);
    const previo = await ctx.emitirToken(`personal_edit_${ctx.sufijo}@example.invalid`);
    expect((await ctx.api(`/usuarios/${alta.data.id}`, { method: 'PATCH', token: root, body: { roles: [] } })).response.status).toBe(409);
    expect((await ctx.api(`/usuarios/${alta.data.id}/personal`, { method: 'PATCH', token: root, body: { plantelIds: [], roles: ['FINANZAS'] } })).response.status).toBe(409);
    expect((await ctx.api(`/usuarios/${alta.data.id}/personal`, { method: 'PATCH', token: root, body: { plantelIds: [ctx.otroPlantelId], roles: ['ADMINISTRATIVO'] } })).response.status).toBe(200);
    expect((await ctx.api('/auth/me', { token: previo })).response.status).toBe(401);
    const detalle = await ctx.api(`/usuarios/${alta.data.id}/personal`, { token: root }); expect(detalle.data.plantelIds).toEqual([ctx.otroPlantelId]); expect(JSON.stringify(detalle.data)).not.toContain('passwordHash');
    expect((await ctx.api(`/usuarios/${ctx.alumnoUsuarioId}/personal`, { method: 'PATCH', token: root, body: { plantelIds: [ctx.plantelId], roles: ['FINANZAS'] } })).response.status).toBe(409);
  });
  },
  42: (ctx) => {
it('recupera push pendiente después de fallar la cola sin duplicar envíos', async () => {
    const push = ctx.app.get(PushService); const fallo = jest.spyOn(push, 'encolar').mockRejectedValueOnce(new Error('Fallo transitorio de DB'));
    const n = await ctx.app.get(NotificacionesService).crear(ctx.alumnoUsuarioId, 'Aviso recuperable', 'Contenido solo en app');
    expect((await ctx.dataSource.getRepository(Notificacion).findOneByOrFail({ id: n.id })).pushPendiente).toBe(true); fallo.mockRestore();
    await push.recuperar(); await push.recuperar();
    expect((await ctx.dataSource.getRepository(Notificacion).findOneByOrFail({ id: n.id })).pushPendiente).toBe(false);
    // El caso previo desactivó la instalación; registrar una activa prueba la recuperación con destinatario real.
    const token = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.alumnoUsuarioId })).email);
    await ctx.api('/notificaciones/push/dispositivos', { method: 'POST', token, body: { instalacionId: randomUUID(), token: `ExponentPushToken[retry${ctx.sufijo}]` } });
    const fallo2 = jest.spyOn(push, 'encolar').mockRejectedValueOnce(new Error('Fallo de cola'));
    const nueva = await ctx.app.get(NotificacionesService).crear(ctx.alumnoUsuarioId, 'Aviso durable', 'Información interna'); fallo2.mockRestore(); await push.recuperar(); await push.recuperar();
    expect(await ctx.dataSource.getRepository(PushEnvio).countBy({ notificacionId: nueva.id })).toBe(1);
  });
  },
  52: (ctx) => {
    it('reactivación y baja concurrentes mantienen coherentes expediente, usuario e inscripciones', async () => {
      const token = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.adminId })).email);
      const alta = await ctx.api('/alumnos',{ method: 'POST',token,body: { email: `rb_${ctx.sufijo}@example.invalid`,nombre: 'Carrera',apellidoPaterno: 'Identidad',password: 'Integracion_Segura_42!',matricula: `RB${ctx.sufijo}`,plantelId: ctx.plantelId } }); expect(alta.response.status).toBe(201);
      expect((await ctx.api(`/alumnos/${alta.data.id}/baja`,{ method: 'POST',token })).response.status).toBe(201);
      const respuestas = await Promise.all([ctx.api(`/alumnos/${alta.data.id}/reactivacion`,{ method: 'POST',token,body: { motivo: 'Reactivación institucional autorizada' } }),ctx.api(`/alumnos/${alta.data.id}/baja`,{ method: 'POST',token })]);
      expect(respuestas.every((r) => [201,409].includes(r.response.status))).toBe(true);
      const alumno = await ctx.dataSource.getRepository(Alumno).findOneByOrFail({ id: alta.data.id });
      expect(alumno.usuario.activo).toBe(alumno.estatus === 'ACTIVO');
      expect(await ctx.dataSource.getRepository(Inscripcion).countBy({ alumnoId: alumno.id,estatus: 'ACTIVA' })).toBe(0);
    });
  },
};
