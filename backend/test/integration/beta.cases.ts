import { CorreoAccesoOutboxService } from '../../src/auth/correo-acceso-outbox.service';
import { AuthCorreoOutbox } from '../../src/entities/auth-correo-outbox.entity';
import { ActivacionService } from '../../src/auth/activacion.service';
import { NotificacionesService } from '../../src/notificaciones/notificaciones.service';
import { ActivacionToken, PasswordResetToken } from '../../src/entities';
import { hashPasswordNueva, compararPassword } from '../../src/common/password-bcrypt';
import { createHash, randomUUID } from 'crypto';
import { instanteActividad } from '../../src/auth/sesion-inactividad';
import { AuthService } from '../../src/auth/auth.service';
import { ContextoIntegracion } from './contexto';
import { expect, it, jest } from '@jest/globals';
import * as ExcelJS from 'exceljs';
import {
  Sesion,
  Calificacion,
  Grupo,
  GrupoMateria,
  Usuario,
  Alumno,
  BibliotecaArchivo,
  ImportacionPreview,
  HistorialCalificacion,
} from '../../src/entities';
import * as antivirus from '../../src/biblioteca/validar-archivo';
import { ServiceUnavailableException } from '@nestjs/common';
export function registrarBeta(ctx: ContextoIntegracion) {
  it('activación: reemisión, consumo concurrente, expiración y aislamiento del restablecimiento', async () => {
    const usuarios = ctx.dataSource.getRepository(Usuario), tokens = ctx.dataSource.getRepository(ActivacionToken);
    const root = await usuarios.findOneByOrFail({ id: ctx.superadminId });
    const password = 'Activacion_Segura_42!';
    const nuevo = await usuarios.save({ email: `activacion_${ctx.sufijo}@example.invalid`, nombre: 'Activación', apellidoPaterno: 'Prueba', activo: true, activacionPendiente: false, passwordHash: await hashPasswordNueva(password), roles: root.roles });
    const auth = ctx.app.get(AuthService), activacion = ctx.app.get(ActivacionService);
    const previa = await auth.login(nuevo.email, password, 'WEB');
    await usuarios.update(nuevo.id, { activacionPendiente: true });
    await expect(auth.login(nuevo.email, password, 'WEB')).rejects.toThrow();
    await expect(auth.refresh(previa.refreshToken, 'WEB')).rejects.toThrow();
    expect((await ctx.api('/auth/me', { token: previa.accessToken })).response.status).toBe(401);
    const correo = jest.spyOn(ctx.app.get(NotificacionesService), 'enviarEmail');
    const codigos: string[] = [];
    correo.mockImplementation(async (_email, _asunto, html) => { codigos.push(html.match(/<strong[^>]*>([a-f0-9]{64})<\/strong>/)![1]); return { simulado: false }; });
    try {
      const generica = await activacion.solicitar('inexistente@example.invalid');
      expect(await activacion.solicitar(nuevo.email)).toEqual(generica);
      await ctx.app.get(CorreoAccesoOutboxService).procesar();
      expect((await tokens.findBy({ usuarioId: nuevo.id }))[0].token).toBe(createHash('sha256').update(codigos[0]).digest('hex'));
      expect(JSON.stringify(generica)).not.toContain(codigos[0]);
      await activacion.solicitar(nuevo.email);
      await ctx.app.get(CorreoAccesoOutboxService).procesar();
      // Repetir una solicitud vigente conserva el primer código; una nueva ventana sí lo revoca.
      expect(codigos).toHaveLength(1);
      await ctx.dataSource.getRepository(AuthCorreoOutbox).update({ usuarioId: nuevo.id }, { expiraEn: new Date(Date.now() - 60000) });
      await activacion.solicitar(nuevo.email);
      await ctx.app.get(CorreoAccesoOutboxService).procesar();
      await expect(activacion.activar(codigos[0], password)).rejects.toThrow();
      const reset = randomUUID();
      await ctx.dataSource.getRepository(PasswordResetToken).save({ usuarioId: nuevo.id, token: createHash('sha256').update(reset).digest('hex'), expiraEn: new Date(Date.now() + 60000), usado: false });
      await expect(auth.resetPassword(reset, password)).rejects.toThrow('Activa primero');
      expect((await ctx.api('/auth/activar-cuenta', { method: 'POST', body: { token: codigos[1], password: 'corta' } })).response.status).toBe(400);
      const resultados = await Promise.allSettled([activacion.activar(codigos[1], password), activacion.activar(codigos[1], password)]);
      expect(resultados.filter(r => r.status === 'fulfilled')).toHaveLength(1);
      const activo = await usuarios.findOne({ where: { id: nuevo.id }, select: ['id', 'passwordHash', 'activacionPendiente', 'passwordChangeRequired', 'sessionVersion'] });
      await expect(auth.resetPassword(reset, 'Otra_Contraseña_42!')).rejects.toThrow();
      expect((await ctx.dataSource.getRepository(PasswordResetToken).findOneByOrFail({ token: createHash('sha256').update(reset).digest('hex') })).usado).toBe(true);
      expect(activo!.activacionPendiente).toBe(false);
      expect(activo!.passwordChangeRequired).toBe(false);
      expect(activo!.sessionVersion).toBe(1);
      expect(await compararPassword(password, activo!.passwordHash)).toBe(true);
      await expect(auth.refresh(previa.refreshToken, 'WEB')).rejects.toThrow();
      await expect(auth.login(nuevo.email, password, 'WEB')).resolves.toHaveProperty('accessToken');
      await usuarios.update(nuevo.id, { activacionPendiente: true });
      await activacion.solicitar(nuevo.email);
      await ctx.app.get(CorreoAccesoOutboxService).procesar();
      await tokens.update({ usuarioId: nuevo.id, usado: false }, { expiraEn: new Date(Date.now() - 60000) });
      await expect(activacion.activar(codigos[2], password)).rejects.toThrow();
      correo.mockResolvedValue({ simulado: true });
      expect(await activacion.solicitar(nuevo.email)).toEqual(generica);
      await ctx.app.get(CorreoAccesoOutboxService).procesar();
      expect((await usuarios.findOneByOrFail({ id: nuevo.id })).activacionPendiente).toBe(true);
    } finally { await ctx.app.get(CorreoAccesoOutboxService).procesar(); correo.mockRestore(); }
  });

  it('sesiones: actividad real, polling sin renovación y expiración de JWT/refresh en ambos motores', async () => {
    const usuario = await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.superadminId });
    await ctx.emitirToken(usuario.email);
    const auth = ctx.app.get(AuthService);
    const tokens = await auth.login(usuario.email, ctx.passwords.get(usuario.email) ?? 'Integracion_Segura_42!', 'WEB');
    const sid = JSON.parse(Buffer.from(tokens.accessToken.split('.')[1], 'base64url').toString()).sid as string;
    const repo = ctx.dataSource.getRepository(Sesion);
    await repo.update({ id: sid }, { ultimaActividadEn: new Date(Date.now() - 120000) });
    const antes = (await repo.findOneByOrFail({ id: sid })).ultimaActividadEn;
    expect((await ctx.api('/auth/me', { token: tokens.accessToken })).response.status).toBe(200);
    expect((await repo.findOneByOrFail({ id: sid })).ultimaActividadEn).toEqual(antes);
    expect((await ctx.api('/auth/actividad', { method: 'POST', token: tokens.accessToken })).response.status).toBe(201);
    expect((await repo.findOneByOrFail({ id: sid })).ultimaActividadEn!.getTime()).toBeGreaterThan(antes!.getTime());
    await repo.update({ id: sid }, { ultimaActividadEn: instanteActividad(Date.now() - 1800001) });
    await expect(auth.refresh(tokens.refreshToken, 'WEB')).rejects.toThrow();
    expect((await repo.findOneByOrFail({ id: sid })).revocada).toBe(true);
    expect((await ctx.api('/auth/actividad', { method: 'POST', token: tokens.accessToken })).response.status).toBe(401);
    expect((await ctx.api('/auth/me', { token: tokens.accessToken })).response.status).toBe(401);
  });

  it('beta: plantilla y preview de notas verifican filas, guardan atómicamente y rechazan un preview obsoleto', async () => {
    const root = await ctx.emitirToken(
      (await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.superadminId })).email,
    );
    const admin = await ctx.emitirToken(
      (await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.adminId })).email,
    );
    const base = await ctx.dataSource.getRepository(GrupoMateria).findOneByOrFail({ id: ctx.grupoMateriaIdMaestro });
    const grupo = await ctx.dataSource.getRepository(Grupo).save({
      nombre: `BETA-${ctx.sufijo}`,
      cicloId: base.grupo.cicloId,
      plantelId: ctx.plantelId,
      grado: '1',
      activo: true,
    });
    const gm = await ctx.dataSource
      .getRepository(GrupoMateria)
      .save({ grupoId: grupo.id, materiaId: base.materiaId, docenteId: base.docenteId });
    const alumnos: Alumno[] = [];
    for (let i = 0; i < 2; i++) {
      const alta = await ctx.api('/alumnos', {
        method: 'POST',
        token: root,
        body: {
          email: `beta${i}_${ctx.sufijo}@example.invalid`,
          nombre: 'Beta',
          apellidoPaterno: 'Notas',
          matricula: `BE${i}${ctx.sufijo}`,
          curp: 'GODE561231HDFRRN09',
          plantelId: ctx.plantelId,
        },
      });
      expect(alta.response.status).toBe(201);
      alumnos.push(await ctx.dataSource.getRepository(Alumno).findOneByOrFail({ id: alta.data.id }));
      expect(
        (
          await ctx.api(`/academico/grupos/${grupo.id}/alumnos`, {
            method: 'POST',
            token: root,
            body: { alumnoId: alta.data.id },
          })
        ).response.status,
      ).toBe(201);
    }
    const params = `grupoMateriaId=${gm.id}&parcial=1`;
    const archivo = await fetch(`${ctx.baseUrl}/importaciones/calificaciones/plantilla?${params}`, {
      headers: { authorization: `Bearer ${root}` },
    });
    expect(archivo.status).toBe(200);
    const alias = await fetch(`${ctx.baseUrl}/reportes/grupo-materias/${gm.id}/plantilla-calificaciones.xlsx?parcial=1`, { headers: { authorization: `Bearer ${root}` } });
    expect(alias.status).toBe(200); expect(alias.headers.get('content-type')).toContain('spreadsheetml');
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(Buffer.from(await archivo.arrayBuffer()) as never);
    expect(libro.worksheets[0].rowCount).toBe(3);
    const preview = async (filas: string[], motivo = '') => {
      const f = new FormData();
      f.append('grupoMateriaId', String(gm.id));
      f.append('parcial', '1');
      f.append('motivo', motivo);
      f.append(
        'archivo',
        new Blob(['grupoMateriaId,parcial,alumnoId,matricula,grado,calificacion\n' + filas.join('\n')]),
        'notas.csv',
      );
      return ctx.api('/importaciones/calificaciones/preview', { method: 'POST', token: root, body: f });
    };
    const fila = (a: Alumno, nota: number) => `${gm.id},1,${a.id},${a.matricula},1,${nota}`;
    const errores = await preview([fila(alumnos[0], 101), fila(alumnos[1], 80)]);
    expect(errores.data.previewId).toBeNull();
    expect(errores.data.errores[0].fila).toBe(2);
    const duplicado = await preview([fila(alumnos[0], 80), fila(alumnos[0], 81)]);
    expect(duplicado.data.errores).toHaveLength(1);
    const p = await preview(alumnos.map((a) => fila(a, 80)));
    expect(p.response.status).toBe(201);
    expect(p.data.diferencias).toHaveLength(2);
    const confirmar = (previewId: string, token = root) =>
      ctx.api('/importaciones/calificaciones/confirmar', {
        method: 'POST',
        token,
        body: { previewId, confirmado: true },
      });
    expect((await confirmar(p.data.previewId, admin)).response.status).toBe(404);
    expect((await confirmar(p.data.previewId)).data.capturadas).toBe(2);
    expect((await confirmar(p.data.previewId)).response.status).toBe(404);
    expect(await ctx.dataSource.getRepository(HistorialCalificacion).countBy({ grupoMateriaId: gm.id })).toBe(2);
    expect((await preview(alumnos.map((a) => fila(a, 81)))).response.status).toBe(400);
    const obsoleto = await preview(
      alumnos.map((a) => fila(a, 81)),
      'Corrección revisada',
    );
    expect(obsoleto.response.status).toBe(201);
    expect(
      (
        await ctx.api('/calificaciones/captura', {
          method: 'POST',
          token: root,
          body: {
            grupoMateriaId: gm.id,
            parcial: 1,
            motivo: 'Otro docente cambió',
            items: [{ alumnoId: alumnos[1].id, calificacion: 82 }],
          },
        })
      ).response.status,
    ).toBe(201);
    expect((await confirmar(obsoleto.data.previewId)).response.status).toBe(409);
    expect(
      Number(
        (
          await ctx.dataSource
            .getRepository(Calificacion)
            .findOneByOrFail({ alumnoId: alumnos[0].id, grupoMateriaId: gm.id, parcial: 1 })
        ).calificacion,
      ),
    ).toBe(80);
    await ctx.dataSource.getRepository(ImportacionPreview).delete(obsoleto.data.previewId);
    const cerrado = await preview(
      alumnos.map((a) => fila(a, 85)),
      'Corrección antes de cierre',
    );
    expect(
      (
        await ctx.api(`/calificaciones/periodos/${gm.id}/1`, {
          method: 'PATCH',
          token: root,
          body: { estatus: 'CERRADO' },
        })
      ).response.status,
    ).toBe(200);
    expect((await confirmar(cerrado.data.previewId)).response.status).toBe(409);
    await ctx.dataSource.getRepository(ImportacionPreview).delete(cerrado.data.previewId);
    const alumnoToken = await ctx.emitirToken(alumnos[0].usuario.email);
    expect(
      (await ctx.api(`/importaciones/calificaciones/plantilla?${params}`, { token: alumnoToken })).response.status,
    ).toBe(403);
  });
  it('beta: edición de calendario verifica origen, destino, fechas y concurrencia', async () => {
    const root = await ctx.emitirToken(
      (await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.superadminId })).email,
    );
    const admin = await ctx.emitirToken(
      (await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.adminId })).email,
    );
    const creado = await ctx.api('/calendario', {
      method: 'POST',
      token: root,
      body: { titulo: 'Beta edición', fechaInicio: '2026-10-14T10:00:00Z', plantelId: ctx.plantelId },
    });
    expect(creado.response.status).toBe(201);
    const listado = await ctx.api('/calendario?desde=2026-10-01&hasta=2026-11-01', { token: root });
    const e = listado.data.find((r: { id: number }) => r.id === creado.data.id);
    const patch = (body: unknown, token = admin) => ctx.api(`/calendario/${e.id}`, { method: 'PATCH', token, body });
    expect((await patch({ revision: e.revision, plantelId: ctx.otroPlantelId })).response.status).toBe(403);
    expect((await patch({ revision: e.revision, fechaFin: '2026-10-13T10:00:00Z' })).response.status).toBe(400);
    const editado = await patch({ revision: e.revision, titulo: 'Beta corregida' });
    expect(editado.response.status).toBe(200);
    expect(editado.data.titulo).toBe('Beta corregida');
    expect((await patch({ revision: e.revision, titulo: 'Sobrescritura' })).response.status).toBe(409);
    const ajeno = await ctx.api('/calendario', {
      method: 'POST',
      token: root,
      body: { titulo: 'Evento ajeno', fechaInicio: '2026-10-14T10:00:00Z', plantelId: ctx.otroPlantelId },
    });
    expect(
      (
        await ctx.api(`/calendario/${ajeno.data.id}`, {
          method: 'PATCH',
          token: admin,
          body: { revision: e.revision, titulo: 'Intento' },
        })
      ).response.status,
    ).toBe(403);
  });
  it('beta: boleta propia firmada no permite cambiar alumno y se revoca con logout', async () => {
    const alumno = await ctx.dataSource
      .getRepository(Alumno)
      .findOneByOrFail({ matricula: `BE0${ctx.sufijo}`.toUpperCase() });
    const token = await ctx.emitirToken(alumno.usuario.email);
    const opciones = await ctx.api('/reportes/mis-boletas', { token });
    expect(opciones.response.status).toBe(200);
    expect(opciones.data.length).toBeGreaterThan(0);
    const propia = opciones.data[0];
    const enlace = await ctx.api(
      `/reportes/mi-boleta/enlace?cicloId=${propia.cicloId}&inscripcionId=${propia.inscripcionId}`,
      { token },
    );
    expect(enlace.response.status).toBe(200);
    const url = new URL(enlace.data.url, ctx.baseUrl);
    const descarga = await fetch(url);
    expect(descarga.status).toBe(200);
    expect(
      Buffer.from(await descarga.arrayBuffer())
        .subarray(0, 4)
        .toString(),
    ).toBe('%PDF');
    expect(descarga.headers.get('cache-control')).toContain('no-store');
    const ajeno = new URL(url);
    ajeno.pathname = ajeno.pathname.replace(`/${alumno.id}`, `/${ctx.alumnoId}`);
    expect((await fetch(ajeno)).status).toBe(403);
    expect((await ctx.api('/auth/logout', { method: 'POST', token })).response.status).toBe(201);
    expect((await fetch(url)).status).toBe(401);
  });
  it('beta: biblioteca aísla planteles, rechaza MIME/antivirus y revoca descargas eliminadas', async () => {
    const root = await ctx.emitirToken(
      (await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.superadminId })).email,
    );
    const admin = await ctx.emitirToken(
      (await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.adminId })).email,
    );
    const a = await ctx.api('/biblioteca/carpetas', {
      method: 'POST',
      token: root,
      body: { plantelId: ctx.plantelId, nombre: `Beta A ${ctx.sufijo}` },
    });
    expect(a.response.status).toBe(201);
    const b = await ctx.api('/biblioteca/carpetas', {
      method: 'POST',
      token: root,
      body: { plantelId: ctx.otroPlantelId, nombre: `Beta B ${ctx.sufijo}` },
    });
    expect(b.response.status).toBe(201);
    expect((await ctx.api(`/biblioteca?plantelId=${ctx.otroPlantelId}`, { token: admin })).response.status).toBe(403);
    expect(
      (
        await ctx.api('/biblioteca/carpetas', {
          method: 'POST',
          token: admin,
          body: { plantelId: ctx.plantelId, padreId: b.data.id, nombre: 'Cruce' },
        })
      ).response.status,
    ).toBe(400);
    const cargar = (contenido: string, nombre = 'calendario.pdf', type = 'application/pdf') => {
      const f = new FormData();
      f.append('carpetaId', String(a.data.id));
      f.append('titulo', 'Calendario privado');
      f.append('categoria', 'CALENDARIO');
      f.append('archivo', new Blob([contenido], { type }), nombre);
      return ctx.api('/biblioteca/archivos', { method: 'POST', token: admin, body: f });
    };
    expect((await cargar('MZ falso')).response.status).toBe(400);
    const scan = jest.spyOn(antivirus, 'escanearArchivo');
    try {
      scan.mockRejectedValueOnce(new ServiceUnavailableException('Antivirus no disponible'));
      expect((await cargar('%PDF-1.7\n%%EOF')).response.status).toBe(503);
      expect(await ctx.dataSource.getRepository(BibliotecaArchivo).countBy({ carpetaId: a.data.id })).toBe(0);
      // Simulación explícita del scanner: este caso certifica aislamiento/flujo, no detección de malware real.
      scan.mockResolvedValue(undefined);
      const alta = await cargar('%PDF-1.7\n%%EOF');
      expect(alta.response.status).toBe(201);
      const enlace = await ctx.api(`/archivos/biblioteca/${alta.data.id}/enlace`, { token: admin });
      expect(enlace.response.status).toBe(200);
      expect((await fetch(new URL(enlace.data.url, ctx.baseUrl))).status).toBe(200);
      const tokenAlumno = await ctx.emitirToken(
        (await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.alumnoUsuarioId })).email,
      );
      expect(
        (await ctx.api(`/archivos/biblioteca/${alta.data.id}/enlace`, { token: tokenAlumno })).response.status,
      ).toBe(403);
      expect(
        (await ctx.api(`/biblioteca/archivos/${alta.data.id}`, { method: 'DELETE', token: admin })).response.status,
      ).toBe(200);
      expect((await fetch(new URL(enlace.data.url, ctx.baseUrl))).status).toBe(404);
    } finally {
      scan.mockRestore();
    }
  });
}
