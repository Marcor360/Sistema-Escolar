import { expect, it } from '@jest/globals';
import {
  CarreraPlan,
  CicloEscolar,
  Grupo,
  Inscripcion,
  NivelAcademico,
  PeriodoAcademico,
  Usuario,
} from '../../src/entities';
import { ContextoIntegracion } from './contexto';
export function registrarCalendarioCiclo(ctx: ContextoIntegracion) {
  it('separa niveles e información interna y autoriza la imagen con las mismas reglas', async () => {
    const ds = ctx.dataSource;
    const admin = await ctx.emitirToken((await ds.getRepository(Usuario).findOneByOrFail({ id: ctx.adminId })).email);
    const fin = await ctx.emitirToken((await ds.getRepository(Usuario).findOneByOrFail({ id: ctx.finanzasId })).email);
    const email = `cal_${ctx.sufijo}@example.invalid`;
    const alta = await ctx.api('/alumnos', {
      method: 'POST',
      token: admin,
      body: {
        email,
        nombre: 'Alumno',
        apellidoPaterno: 'Calendario',
        matricula: `CA${ctx.sufijo}`,
        plantelId: ctx.plantelId,
        curp: 'GODE561231HDFRRN09',
      },
    });
    expect(alta.response.status).toBe(201);
    const ciclo = await ds.getRepository(CicloEscolar).findOneByOrFail({ clave: `C${ctx.sufijo}` });
    const niveles = await ds.getRepository(NivelAcademico).save([
      { plantelId: ctx.plantelId, clave: `CS${ctx.sufijo}`, nombre: 'Secundaria QA', activo: true },
      { plantelId: ctx.plantelId, clave: `CB${ctx.sufijo}`, nombre: 'Bachillerato QA', activo: true },
    ]);
    const carrera = await ds.getRepository(CarreraPlan).save({
      plantelId: ctx.plantelId,
      nivelId: niveles[0].id,
      clave: `CA${ctx.sufijo}`,
      nombre: 'Secundaria QA',
      versionPlan: 'QA',
      activo: true,
    });
    const periodo = await ds.getRepository(PeriodoAcademico).save({
      plantelId: ctx.plantelId,
      carreraId: carrera.id,
      cicloId: ciclo.id,
      clave: 'CAL',
      nombre: 'Anual QA',
      tipo: 'ANUAL',
      numero: 1,
      activo: true,
    });
    const grupo = await ds.getRepository(Grupo).save({
      plantelId: ctx.plantelId,
      cicloId: ciclo.id,
      nivelId: niveles[0].id,
      carreraId: carrera.id,
      periodoAcademicoId: periodo.id,
      nombre: `Cal ${ctx.sufijo}`,
      tipo: 'REGULAR',
      activo: true,
    });
    await ds.getRepository(Inscripcion).save({ alumnoId: alta.data.id, grupoId: grupo.id, estatus: 'ACTIVA' });
    const base = { plantelId: ctx.plantelId, cicloId: ciclo.id, fechaInicio: ciclo.fechaInicio + 'T12:00:00-06:00' };
    const ids: number[] = [];
    for (const [nivel, audiencia] of [
      [niveles[0].id, 'ACADEMICA'],
      [niveles[1].id, 'ACADEMICA'],
      [niveles[0].id, 'FINANCIERA'],
    ] as const) {
      const r = await ctx.api('/calendario', {
        method: 'POST',
        token: admin,
        body: { ...base, nivelId: nivel, audiencia, titulo: 'Calendario ' + audiencia + nivel },
      });
      expect(r.response.status).toBe(201);
      ids.push(r.data.id);
    }
    const alumno = await ctx.emitirToken(email);
    const query = `?desde=${ciclo.fechaInicio}T00:00:00Z&hasta=${ciclo.fechaFin}T23:59:59Z&cicloId=${ciclo.id}`;
    const propios = await ctx.api('/calendario' + query, { token: alumno });
    expect(propios.data.some((e: { id: number }) => e.id === ids[0])).toBe(true);
    expect(propios.data.some((e: { id: number }) => ids.slice(1).includes(e.id))).toBe(false);
    const personal = await ctx.api('/calendario' + query, { token: fin });
    expect(personal.response.status).toBe(200);
    expect(ids.every((id) => personal.data.some((e: { id: number }) => e.id === id))).toBe(true);
    const form = new FormData();
    Object.entries({ ...base, nivelId: niveles[1].id, titulo: 'Imagen de bachillerato' }).forEach(([k, v]) =>
      form.append(k, String(v)),
    );
    form.append(
      'imagen',
      new Blob(
        [
          Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=',
            'base64',
          ),
        ],
        { type: 'image/png' },
      ),
      'cal.png',
    );
    const subida = await fetch(ctx.baseUrl + '/calendario/imagen', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + admin },
      body: form,
    });
    expect(subida.status).toBe(201);
    const imagen = (await subida.json()) as { id: number };
    expect((await ctx.api(`/archivos/calendario/${imagen.id}/enlace`, { token: alumno })).response.status).toBe(403);
    const enlace = await ctx.api(`/archivos/calendario/${imagen.id}/enlace`, { token: fin });
    expect(enlace.response.status).toBe(200);
    const lectura = await fetch(ctx.baseUrl.replace(/\/api$/, '') + enlace.data.url);
    expect(lectura.status).toBe(200);
    expect(lectura.headers.get('cache-control')).toContain('no-store');
    const opciones = await ctx.api('/calendario/opciones', { token: alumno });
    expect(opciones.data.niveles.map((n: { id: number }) => n.id)).toEqual([niveles[0].id]);
    expect((await ctx.api('/calendario' + query + `&nivelId=${niveles[1].id}`, { token: alumno })).data).toEqual([]);
    const invalida = new FormData();
    Object.entries({ ...base, nivelId: niveles[0].id, titulo: 'Firma inválida' }).forEach(([k, v]) =>
      invalida.append(k, String(v)),
    );
    invalida.append('imagen', new Blob(['no es una imagen'], { type: 'image/png' }), 'falsa.png');
    expect(
      (
        await fetch(ctx.baseUrl + '/calendario/imagen', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + admin },
          body: invalida,
        })
      ).status,
    ).toBe(400);
    const finOtroPlantel = await ctx.emitirFinanzasB();
    expect((await ctx.api(`/archivos/calendario/${imagen.id}/enlace`, { token: finOtroPlantel })).response.status).toBe(
      403,
    );
    expect(
      (
        await ctx.api('/calendario', {
          method: 'POST',
          token: fin,
          body: { ...base, plantelId: ctx.otroPlantelId, nivelId: niveles[0].id, titulo: 'Fuera de alcance' },
        })
      ).response.status,
    ).toBe(403);
    const sinToken = await fetch(ctx.baseUrl + `/archivos/calendario/${imagen.id}?t=invalido`);
    expect(sinToken.status).toBe(401);
    expect(
      (await ctx.api('/calendario', { method: 'POST', token: alumno, body: { ...base, titulo: 'No permitido' } }))
        .response.status,
    ).toBe(403);
  });
}
