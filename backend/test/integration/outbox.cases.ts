import { it, expect, jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { In } from 'typeorm';
import { CorreoAccesoOutboxService } from '../../src/auth/correo-acceso-outbox.service';
import { ActivacionService } from '../../src/auth/activacion.service';
import { AuthService } from '../../src/auth/auth.service';
import { NotificacionesService } from '../../src/notificaciones/notificaciones.service';
import { ActivacionToken, AuthCorreoOutbox, PasswordResetToken, Usuario } from '../../src/entities';
import { ContextoIntegracion } from './contexto';

export function registrarOutbox(ctx: ContextoIntegracion) {
  const nuevo = async (clave: string, pendiente = true) => {
    const root = await ctx.dataSource.getRepository(Usuario).findOne({ where: { id: ctx.superadminId }, select: ['id', 'passwordHash'] });
    return ctx.dataSource.getRepository(Usuario).save({ email: `outbox_${clave}_${ctx.sufijo}@example.invalid`, nombre: 'Outbox', apellidoPaterno: 'Prueba', activo: true, activacionPendiente: pendiente, passwordHash: root!.passwordHash, sessionVersion: 0 });
  };
  const reiniciar = () => new CorreoAccesoOutboxService(ctx.dataSource, ctx.app.get(NotificacionesService), ctx.app.get(ConfigService));
  const repo = () => ctx.dataSource.getRepository(AuthCorreoOutbox);
  const drenar = () => ctx.app.get(CorreoAccesoOutboxService).procesar();
  const anticipar = async (id: string) => repo().update(id, { proximoIntento: new Date(Date.now() - 1000) });

  it('outbox: 110 solicitudes concurrentes se confirman y coalescen sin SMTP ni pérdida por reinicio', async () => {
    const usuario = await nuevo('coalescer');
    const correo = jest.spyOn(ctx.app.get(NotificacionesService), 'enviarEmail').mockResolvedValue({ simulado: false });
    try {
      // Lotes acotados para no agotar el pool de la base de integración.
      for (let i = 0; i < 11; i++) await Promise.all(Array.from({ length: 10 }, () => ctx.app.get(ActivacionService).solicitar(usuario.email)));
      expect(await repo().countBy({ usuarioId: usuario.id })).toBe(1);
      expect(correo).not.toHaveBeenCalled();
      const trabajo = await repo().findOneByOrFail({ usuarioId: usuario.id });
      expect(trabajo.tokenHash).toBeNull();
      expect(await reiniciar().procesar()).toBeGreaterThanOrEqual(1);
      expect(correo).toHaveBeenCalledTimes(1);
      expect((await repo().findOneByOrFail({ id: trabajo.id })).estado).toBe('ACEPTADO');
    } finally { correo.mockRestore(); }
  });

  it('outbox: activación reenvía tras 60 segundos sin duplicar ni renovar código o caducidad', async () => {
    const usuario = await nuevo('reenvio60');
    const correo = jest.spyOn(ctx.app.get(NotificacionesService), 'enviarEmail').mockResolvedValue({ simulado: false });
    try {
      const servicio = ctx.app.get(ActivacionService);
      await servicio.solicitar(usuario.email);
      await drenar();
      const original = await repo().findOneByOrFail({ usuarioId: usuario.id });
      expect(original.estado).toBe('ACEPTADO');
      await servicio.solicitar(usuario.email);
      expect((await repo().findOneByOrFail({ id: original.id })).estado).toBe('ACEPTADO');
      await repo().update(original.id, { proximoIntento: new Date(Date.now() - 61_000) });
      await Promise.all(Array.from({ length: 5 }, () => servicio.solicitar(usuario.email)));
      expect(await repo().countBy({ usuarioId: usuario.id })).toBe(1);
      const reenviado = await repo().findOneByOrFail({ id: original.id });
      expect(reenviado.estado).toBe('PENDIENTE');
      expect(reenviado.tokenHash).toBe(original.tokenHash);
      expect(reenviado.expiraEn.getTime()).toBe(original.expiraEn.getTime());
      await anticipar(original.id);
      await drenar();
      expect(correo).toHaveBeenCalledTimes(2);
      expect(correo.mock.calls[1]).toEqual(correo.mock.calls[0]);
      expect(await ctx.dataSource.getRepository(ActivacionToken).countBy({ usuarioId: usuario.id })).toBe(1);
    } finally { correo.mockRestore(); }
  });

  it('outbox: fallo SMTP y reinicio conservan el mismo código, hash y Message-ID; dos workers no lo envían a la vez', async () => {
    const usuario = await nuevo('reintento');
    await ctx.app.get(ActivacionService).solicitar(usuario.email);
    const trabajo = await repo().findOneByOrFail({ usuarioId: usuario.id });
    const intentos: { codigo: string; messageId?: string }[] = [];
    const correo = jest.spyOn(ctx.app.get(NotificacionesService), 'enviarEmail').mockImplementation(async (_to, _subject, html, messageId) => {
      intentos.push({ codigo: html.match(/<strong[^>]*>([a-f0-9]{64})<\/strong>/)![1], messageId });
      if (intentos.length === 1) throw new Error('SMTP fallo con datos que nunca deben persistirse');
      await new Promise<void>(r => setTimeout(r, 50));
      return { simulado: false };
    });
    try {
      await drenar();
      const fallo = await repo().findOneByOrFail({ id: trabajo.id });
      expect(fallo.estado).toBe('PENDIENTE');
      expect(fallo.intentos).toBe(1);
      expect(fallo.proximoIntento.getTime()).toBeGreaterThan(Date.now());
      expect(fallo.errorCodigo).toBe('ENVIO_NO_CONFIRMADO');
      expect(JSON.stringify(fallo)).not.toContain(intentos[0].codigo);
      expect((await ctx.dataSource.getRepository(ActivacionToken).findOneByOrFail({ usuarioId: usuario.id, usado: false })).token)
        .toBe(createHash('sha256').update(intentos[0].codigo).digest('hex'));
      await anticipar(trabajo.id);
      await Promise.all([reiniciar().procesar(), reiniciar().procesar()]);
      expect(intentos).toHaveLength(2);
      expect(intentos[1]).toEqual(intentos[0]);
      expect(intentos[0].messageId).toBe(`acceso-${trabajo.id}@example.invalid`);
      expect(await ctx.dataSource.getRepository(ActivacionToken).countBy({ usuarioId: usuario.id })).toBe(1);
      expect((await repo().findOneByOrFail({ id: trabajo.id })).estado).toBe('ACEPTADO');
      // Caída tras aceptación SMTP y antes de confirmar estado: lease vencido, mismo token en reentrega.
      await repo().update(trabajo.id, { estado: 'PROCESANDO', claim: 'claim-del-proceso-caido', leaseHasta: new Date(Date.now() - 1000), proximoIntento: new Date(Date.now() - 1000) });
      await reiniciar().procesar();
      expect(intentos).toHaveLength(3);
      expect(intentos[2]).toEqual(intentos[0]);
    } finally { correo.mockRestore(); }
  });

  it('outbox: no roba leases vigentes y cancela al cambiar versión, activar o deshabilitar la cuenta', async () => {
    const correo = jest.spyOn(ctx.app.get(NotificacionesService), 'enviarEmail').mockResolvedValue({ simulado: false });
    try {
      const usuario = await nuevo('lease');
      await ctx.app.get(ActivacionService).solicitar(usuario.email);
      const trabajo = await repo().findOneByOrFail({ usuarioId: usuario.id });
      await repo().update(trabajo.id, { estado: 'PROCESANDO', claim: 'otro-worker', leaseHasta: new Date(Date.now() + 60000) });
      await reiniciar().procesar();
      expect(correo).not.toHaveBeenCalled();
      await ctx.dataSource.getRepository(Usuario).increment({ id: usuario.id }, 'sessionVersion', 1);
      await repo().update(trabajo.id, { leaseHasta: new Date(Date.now() - 1000) });
      await reiniciar().procesar();
      expect((await repo().findOneByOrFail({ id: trabajo.id })).estado).toBe('CANCELADO');
      for (const cambio of [{ activo: false }, { activacionPendiente: false }]) {
        const otro = await nuevo('cancelar' + Object.keys(cambio)[0]);
        await ctx.app.get(ActivacionService).solicitar(otro.email);
        await ctx.dataSource.getRepository(Usuario).update(otro.id, cambio);
        await drenar();
        expect((await repo().findOneByOrFail({ usuarioId: otro.id })).estado).toBe('CANCELADO');
      }
      expect(correo).not.toHaveBeenCalled();
    } finally { correo.mockRestore(); }
  });

  it('outbox: recuperación mantiene respuesta genérica, uso único y revocación de códigos anteriores', async () => {
    const usuario = await nuevo('recuperar', false);
    const auth = ctx.app.get(AuthService);
    const original = 'codigo-anterior';
    await ctx.dataSource.getRepository(PasswordResetToken).save({ usuarioId: usuario.id, token: createHash('sha256').update(original).digest('hex'), expiraEn: new Date(Date.now() + 60000), usado: false });
    const correo = jest.spyOn(ctx.app.get(NotificacionesService), 'enviarEmail').mockResolvedValue({ simulado: false });
    try {
      const generica = await auth.forgotPassword('inexistente@example.invalid');
      expect(await auth.forgotPassword(usuario.email)).toEqual(generica);
      expect(correo).not.toHaveBeenCalled();
      await drenar();
      const codigo = correo.mock.calls[0][2].match(/<strong[^>]*>([a-f0-9]{32})<\/strong>/)![1];
      const hash = createHash('sha256').update(codigo).digest('hex');
      expect((await ctx.dataSource.getRepository(PasswordResetToken).findOneByOrFail({ usuarioId: usuario.id, usado: false })).token).toBe(hash);
      await expect(auth.resetPassword(original, 'Outbox_Recuperada_42!')).rejects.toThrow();
      await auth.resetPassword(codigo, 'Outbox_Recuperada_42!');
      await expect(auth.resetPassword(codigo, 'Outbox_Recuperada_43!')).rejects.toThrow();
      expect((await ctx.dataSource.getRepository(Usuario).findOneByOrFail({ id: usuario.id })).sessionVersion).toBe(1);
    } finally { correo.mockRestore(); }
  });

  it('outbox: SMTP lento no retiene locks ni impide commits de seguridad; el token ya está confirmado', async () => {
    const usuario = await nuevo('sinlock');
    await ctx.app.get(ActivacionService).solicitar(usuario.email);
    let liberar!: () => void, empezo!: () => void;
    const bloqueado = new Promise<void>(r => { liberar = r; });
    const iniciado = new Promise<void>(r => { empezo = r; });
    const correo = jest.spyOn(ctx.app.get(NotificacionesService), 'enviarEmail').mockImplementation(async () => {
      empezo(); await bloqueado; return { simulado: false };
    });
    const proceso = drenar();
    try {
      await iniciado;
      expect(await ctx.dataSource.getRepository(ActivacionToken).countBy({ usuarioId: usuario.id, usado: false })).toBe(1);
      const transaccion = ctx.dataSource.transaction(async m => {
        const usuarios = m.getRepository(Usuario);
        const actual = await usuarios.findOne({ where: { id: usuario.id }, lock: { mode: 'pessimistic_write' } });
        await usuarios.update(actual!.id, { sessionVersion: 1 });
      });
      let timer: ReturnType<typeof setTimeout> | undefined;
      try { await Promise.race([transaccion, new Promise((_, rechazar) => { timer = setTimeout(() => rechazar(new Error('SMTP retuvo un lock de usuario')), 5000); })]); }
      finally { if (timer) clearTimeout(timer); }
    } finally { liberar(); await proceso; correo.mockRestore(); }
  });

  it('outbox: 112 solicitudes distintas sobreviven sin el antiguo tope de cien, en lotes de diez', async () => {
    const usuarios: Usuario[] = [];
    for (let i = 0; i < 112; i++) {
      const usuario = await nuevo('lote' + i); usuarios.push(usuario);
      await ctx.app.get(ActivacionService).solicitar(usuario.email);
    }
    const correo = jest.spyOn(ctx.app.get(NotificacionesService), 'enviarEmail').mockResolvedValue({ simulado: false });
    try {
      expect(await reiniciar().procesar()).toBe(10);
      expect(correo).toHaveBeenCalledTimes(10);
      expect(await repo().countBy({ usuarioId: In(usuarios.map(u => u.id)), estado: 'PENDIENTE' })).toBe(102);
      let restantes = 102;
      while (restantes > 0) {
        const lote = await reiniciar().procesar();
        expect(lote).toBe(Math.min(10, restantes)); restantes -= lote;
      }
      expect(correo).toHaveBeenCalledTimes(112);
    } finally { correo.mockRestore(); }
  });

  it('outbox: seis fallos terminan sin reintentos infinitos; TTL y retención se aplican en DB', async () => {
    const usuario = await nuevo('terminal');
    const correo = jest.spyOn(ctx.app.get(NotificacionesService), 'enviarEmail').mockResolvedValue({ simulado: true });
    try {
      await ctx.app.get(ActivacionService).solicitar(usuario.email);
      const trabajo = await repo().findOneByOrFail({ usuarioId: usuario.id });
      for (let i = 0; i < 6; i++) { await anticipar(trabajo.id); await reiniciar().procesar(); }
      const terminal = await repo().findOneByOrFail({ id: trabajo.id });
      expect(terminal.estado).toBe('FALLIDO'); expect(terminal.intentos).toBe(6);
      await anticipar(trabajo.id); await reiniciar().procesar(); expect(correo).toHaveBeenCalledTimes(6);
      const vencido = await nuevo('ttl');
      await ctx.app.get(ActivacionService).solicitar(vencido.email);
      await repo().update({ usuarioId: vencido.id }, { expiraEn: new Date(Date.now() - 1000) });
      await drenar(); expect((await repo().findOneByOrFail({ usuarioId: vencido.id })).estado).toBe('EXPIRADO');
      await repo().update({ usuarioId: vencido.id }, { expiraEn: new Date(Date.now() - 31 * 86400000) });
      await drenar(); expect(await repo().countBy({ usuarioId: vencido.id })).toBe(0);
      expect(correo).toHaveBeenCalledTimes(6);
    } finally { correo.mockRestore(); }
  });
}
