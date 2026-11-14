import { expect, it } from '@jest/globals';
import { randomUUID } from 'crypto';
import { Cargo, ConceptoPago, Docente, Rol, Usuario, UsuarioPlantel } from '../../src/entities';
import { ContextoIntegracion } from './contexto';
import { curpFicticia } from './identidad-ficticia';
export function registrarAperturaFlexible(ctx: ContextoIntegracion) {
  it('apertura flexible: nivel suficiente para registrar; completa contexto, permite grupo sin materias y recuerda profesor pendiente', async () => {
    const token = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.superadminId })).email);
    const post = async (ruta: string, body: unknown) => {
      const r = await ctx.api(ruta, { method: 'POST', token, body });
      expect({ status: r.response.status, data: r.data }).toMatchObject({ status: 201 });
      return r.data;
    };
    const ciclo = await post('/academico/ciclos', { clave: `FX${ctx.sufijo}`, nombre: 'Flexible QA', fechaInicio: '2060-01-01', fechaFin: '2060-12-31' });
    const nivel = await post('/academico/catalogos/niveles', { plantelId: ctx.plantelId, clave: `FX${ctx.sufijo}`, nombre: 'Secundaria' });
    const concepto = await ctx.dataSource.getRepository(ConceptoPago).save({ clave: `FX${ctx.sufijo}`, nombre: 'Cuota QA', tipo: 'INSCRIPCION', montoBase: 100, activo: true, aplicaRecargo: false });
    const base = { nuevoAlumno: { nombre: 'Ana', apellidoPaterno: 'Prueba', apellidoMaterno: 'Ficticia', matricula: `FX${ctx.sufijo}`, curp: curpFicticia() }, plantelId: ctx.plantelId, cicloId: ciclo.id, nivelId: nivel.id, turno: 'MATUTINO', asignacion: 'AUTOMATICA', total: 100, cuotas: [{ conceptoId: concepto.id, monto: 100, periodo: '2060-02', fechaVencimiento: '2060-02-05' }] };
    const cotizacion = await post('/cartera/integral/previsualizar', base);
    expect(cotizacion.avisos.join(' ')).toContain('plan');
    const apertura = await post('/cartera/integral/confirmar', { ...base, cotizacion: cotizacion.cotizacion, idempotencia: randomUUID(), confirmado: true });
    expect(apertura).toMatchObject({ estado: 'PAUSA', grupoId: null });
    expect(await ctx.dataSource.getRepository(Cargo).countBy({ alumnoId: apertura.alumnoId })).toBe(0);
    expect(apertura.avisos.join(' ')).toContain('grupo');
    expect((await ctx.api(`/cartera/${apertura.id}/reanudar`, { method: 'POST', token, body: { motivo: 'Completar contexto académico', confirmado: true } })).response.status).toBe(409);
    const carrera = await post('/academico/catalogos/carreras', { plantelId: ctx.plantelId, nivelId: nivel.id, clave: `FX${ctx.sufijo}`, nombre: 'Plan QA', versionPlan: 'QA' });
    const periodo = await post('/academico/catalogos/periodos', { plantelId: ctx.plantelId, carreraId: carrera.id, cicloId: ciclo.id, clave: 'P1', nombre: 'Primero', tipo: 'ANUAL', numero: 1 });
    const grupo = await post('/academico/grupos', { plantelId: ctx.plantelId, cicloId: ciclo.id, nivelId: nivel.id, carreraId: carrera.id, periodoAcademicoId: periodo.id, nombre: `FX${ctx.sufijo}`, turno: 'MATUTINO' });
    await post(`/cartera/${apertura.id}/reanudar`, { carreraId: carrera.id, periodoAcademicoId: periodo.id, grupoId: grupo.id, motivo: 'Completar contexto y grupo', confirmado: true });
    const detalle = async () => (await ctx.api(`/cartera/${apertura.id}`, { token })).data;
    expect((await detalle()).avisos).toContain('El grupo todavía no tiene materias asignadas.');
    const materia = await post('/academico/materias', { clave: `FX${ctx.sufijo}`, nombre: 'Materia sin profesor' });
    await post(`/academico/grupos/${grupo.id}/materias`, { materiaId: materia.id });
    expect((await detalle()).avisos.join(' ')).toContain('sin profesor activo');
    expect(await ctx.dataSource.getRepository(Cargo).countBy({ alumnoId: apertura.alumnoId })).toBe(1);
  });

  it('personal combinado: director, administrativo y finanzas son docentes sin duplicar cuenta; baja docente conserva otras funciones', async () => {
    const token = await ctx.emitirToken((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: ctx.superadminId })).email);
    for (const [indice, clave] of ['DIRECTOR', 'ADMINISTRATIVO', 'FINANZAS'].entries()) {
      const repo = ctx.dataSource.getRepository(Usuario);
      const rol = await ctx.dataSource.getRepository(Rol).findOneByOrFail({ clave });
      const usuario = await repo.save(repo.create({ email: `mix${indice}${ctx.sufijo}@example.invalid`, passwordHash: 'solo-prueba-no-login', nombre: 'Personal', apellidoPaterno: 'Prueba', apellidoMaterno: 'Ficticia', activo: true, roles: [rol] }));
      await ctx.dataSource.getRepository(UsuarioPlantel).insert({ usuarioId: usuario.id, plantelId: ctx.plantelId, activo: true });
      const antes = await repo.count();
      const datos = { usuarioId: usuario.id, numEmpleado: `MX${indice}${ctx.sufijo}`, cedulaPendiente: true };
      if (clave === 'DIRECTOR') {
        const admin = await ctx.emitirToken((await repo.findOneByOrFail({ id: ctx.adminId })).email);
        expect((await ctx.api('/docentes/vincular-personal', { method: 'POST', token: admin, body: datos })).response.status).toBe(403);
      }
      const vinculo = await ctx.api('/docentes/vincular-personal', { method: 'POST', token, body: datos });
      expect({ status: vinculo.response.status, datos: vinculo.data }).toMatchObject({ status: 201 });
      expect(await repo.count()).toBe(antes);
      expect((await ctx.api(`/usuarios/${usuario.id}/personal`, { token })).response.status).toBe(200);
      const editar = await ctx.api(`/usuarios/${usuario.id}/personal`, { method: 'PATCH', token, body: { plantelIds: [ctx.plantelId], roles: [clave, 'MAESTRO'], nombre: 'Personal combinado' } });
      expect({ status: editar.response.status, data: editar.data }).toMatchObject({ status: 200 });
      expect((await ctx.api(`/usuarios/${usuario.id}/personal`, { method: 'PATCH', token, body: { plantelIds: [ctx.plantelId], roles: [clave] } })).response.status).toBe(409);
      expect((await ctx.api(`/docentes/${vinculo.data.id}/planteles`, { method: 'POST', token, body: { plantelIds: [ctx.plantelId] } })).response.status).toBe(409);
      expect((await repo.findOneByOrFail({ id: usuario.id })).roles.map(r => r.clave).sort()).toEqual([clave, 'MAESTRO'].sort());
      expect((await ctx.api('/docentes/vincular-personal', { method: 'POST', token, body: datos })).response.status).toBe(409);
      expect((await ctx.api(`/usuarios/${usuario.id}/roles`, { method: 'PATCH', token, body: { roles: ['MAESTRO'] } })).response.status).toBe(200);
      expect((await ctx.api(`/usuarios/${usuario.id}/roles`, { method: 'PATCH', token, body: { roles: ['MAESTRO', clave] } })).response.status).toBe(200);
      expect((await ctx.api(`/docentes/${vinculo.data.id}/baja`, { method: 'POST', token })).response.status).toBe(201);
      const baja = await repo.findOneByOrFail({ id: usuario.id });
      expect(baja.activo).toBe(true); expect(baja.roles.map(r => r.clave)).toEqual([clave]);
      expect(await ctx.dataSource.getRepository(UsuarioPlantel).countBy({ usuarioId: usuario.id, activo: true })).toBe(1);
      expect((await ctx.dataSource.getRepository(Docente).findOneByOrFail({ id: vinculo.data.id })).estatus).toBe('BAJA');
      expect((await ctx.api(`/docentes/${vinculo.data.id}/reactivacion`, { method: 'POST', token, body: { plantelIds: [ctx.plantelId], motivo: 'Retoma sus actividades docentes' } })).response.status).toBe(201);
      expect((await repo.findOneByOrFail({ id: usuario.id })).roles.map(r => r.clave)).toContain('MAESTRO');
    }
  });
}
