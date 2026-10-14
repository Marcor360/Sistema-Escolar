import { ContextoIntegracion } from './contexto';
import { expect, it, jest } from '@jest/globals';
import * as ExcelJS from 'exceljs';
import {
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
