import { expect, it } from '@jest/globals';
import { randomUUID } from 'crypto';
import { Alumno, AperturaCartera, CicloEscolar, Rol, Usuario } from '../../src/entities';
import { ContextoIntegracion } from './contexto';
export function registrarPendientesInscripcion(ctx: ContextoIntegracion) {
  it('pendientes de inscripción: plantel, activación separada, pausa y enlaces filtrados sin ampliar roles', async () => {
    const token = await ctx.emitirToken(
      (await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.adminId })).email,
    );
    const raiz = await ctx.emitirToken(
      (await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.superadminId })).email,
    );
    const fin = await ctx.emitirToken(
      (await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.finanzasId })).email,
    );
    const prefijo = `QPS${ctx.sufijo}`;
    const alumnoRol = await ctx.dataSource.getRepository(Rol).findOneByOrFail({ clave: 'ALUMNO' });
    const ruta = `/seguimiento/pendientes?plantelId=${ctx.plantelId}`;
    const antes = (await ctx.api(ruta, { token })).data;
    const crear = async (
      sufijo: string,
      email: string | null,
      plantelId = ctx.plantelId,
      activo = true,
      activacionPendiente = true,
    ) => {
      const usuario = await ctx.dataSource.getRepository(Usuario).save({
        email,
        passwordHash: 'fixture-sin-acceso',
        nombre: 'Pendiente QA',
        apellidoPaterno: sufijo,
        activo,
        activacionPendiente,
        roles: [alumnoRol],
      });
      return ctx.dataSource
        .getRepository(Alumno)
        .save({ usuarioId: usuario.id, plantelId, matricula: `${prefijo}${sufijo}`, estatus: 'ACTIVO' });
    };
    const sinCorreo = await crear('SC', null);
    const pendiente = await crear('AP', `ps${ctx.sufijo}@example.invalid`);
    await crear('SN', null, ctx.plantelId, false);
    await crear('IN', `pi${ctx.sufijo}@example.invalid`, ctx.plantelId, false);
    await crear('OK', `po${ctx.sufijo}@example.invalid`, ctx.plantelId, true, false);
    await crear('AJ', null, ctx.otroPlantelId);
    const ciclo = await ctx.dataSource.getRepository(CicloEscolar).save({
      clave: `PS${ctx.sufijo}`,
      nombre: 'Pendientes QA',
      fechaInicio: '2057-01-01',
      fechaFin: '2057-12-31',
      estado: 'PREPARACION',
      activo: false,
    });
    const apertura = await ctx.dataSource.getRepository(AperturaCartera).save({
      idempotencia: randomUUID(),
      peticionHash: 'a'.repeat(64),
      alumnoId: sinCorreo.id,
      plantelId: ctx.plantelId,
      cicloId: ciclo.id,
      creadoPorId: ctx.adminId,
      estado: 'PAUSA',
      conceptos: [],
      contextoJson: null,
    });
    const despues = (await ctx.api(ruta, { token })).data;
    for (const titulo of [
      'Alumnos sin correo institucional',
      'Alumnos con activación pendiente',
      'Carteras en pausa',
    ]) {
      expect(despues.find((p: { titulo: string }) => p.titulo === titulo).cantidad).toBe(
        antes.find((p: { titulo: string }) => p.titulo === titulo).cantidad + 1,
      );
    }
    for (const titulo of ['Alumnos con activación pendiente', 'Carteras en pausa']) {
      const enlace = despues.find((p: { titulo: string }) => p.titulo === titulo).ruta;
      const listado = await ctx.api(
        enlace
          .replace('/apertura-cartera', '/cartera')
          .replace('/usuarios?', '/usuarios/listado?')
          .replace('&plantel=', '&plantelId='),
        { token },
      );
      expect(listado.response.status).toBe(200);
      expect(
        listado.data.datos.some(
          (fila: { id: number }) => fila.id === (titulo === 'Carteras en pausa' ? apertura.id : pendiente.id),
        ),
      ).toBe(true);
    }
    const sinCorreoFiltrados = await ctx.api(
      `/usuarios/listado?tipo=ALUMNO&sinCorreo=true&plantelId=${ctx.plantelId}&buscar=${prefijo}`,
      { token },
    );
    expect(sinCorreoFiltrados.data.datos.map((fila: { id: number }) => fila.id)).toEqual([sinCorreo.id]);
    expect(
      (await ctx.api('/usuarios/listado?tipo=ALUMNO&activacionPendiente=true', { token: fin })).response.status,
    ).toBe(403);
    const filtrados = await ctx.api(
      `/usuarios/listado?tipo=ALUMNO&activacionPendiente=true&plantelId=${ctx.plantelId}&buscar=${prefijo}`,
      { token },
    );
    expect(filtrados.data.datos.map((fila: { id: number }) => fila.id)).toEqual([pendiente.id]);
    expect((await ctx.api(`/seguimiento/pendientes?plantelId=${ctx.otroPlantelId}`, { token })).response.status).toBe(
      403,
    );
    expect((await ctx.api('/seguimiento/pendientes?plantelId=0', { token })).response.status).toBe(400);
    const financiero = await ctx.api(ruta, { token: fin });
    expect(financiero.data.some((p: { titulo: string }) => /correo|activación|pausa/.test(p.titulo))).toBe(false);
    const global = await ctx.api(`/seguimiento/pendientes?plantelId=${ctx.otroPlantelId}`, { token: raiz });
    expect(global.response.status).toBe(200);
    expect(
      global.data.find((p: { titulo: string }) => p.titulo === 'Alumnos sin correo institucional').cantidad,
    ).toBeGreaterThanOrEqual(1);
    // El filtro de pausa no debe devolver una apertura que ya cambió de estado.
    await ctx.dataSource.getRepository(AperturaCartera).update(apertura.id, { estado: 'ABIERTA' });
    const abiertas = await ctx.api(`/cartera?estado=PAUSA&plantelId=${ctx.plantelId}`, { token });
    expect(abiertas.data.datos.some((fila: { id: number }) => fila.id === apertura.id)).toBe(false);
  });
}
