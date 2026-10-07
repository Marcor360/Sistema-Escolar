import { Injectable, Logger, OnModuleDestroy, OnModuleInit, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, In, LessThan } from 'typeorm';
import axios from 'axios';
import { PushDispositivo } from '../entities/push-dispositivo.entity';
import { PushEnvio } from '../entities/push-envio.entity';
import { Sesion } from '../entities/sesion.entity';
import { Usuario } from '../entities/usuario.entity';
import { Notificacion } from '../entities/notificacion.entity';
import { JwtUser } from '../common/current-user.decorator';
import { RegistrarPushDto } from './push.dto';

@Injectable()
export class PushService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private trabajando = false;
  private readonly logger = new Logger(PushService.name);
  constructor(private readonly ds: DataSource, private readonly config: ConfigService) {}
  onModuleInit() {
    {
      this.timer = setInterval(() => { void this.recuperar().then(() => this.procesar()).catch(() => this.logger.warn('No se pudo procesar push; revisar proveedor/configuración')); }, 30000);
      this.timer.unref();
    }
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
  async registrar(dto: RegistrarPushDto, user: JwtUser) {
    if (!user.roles.includes('ALUMNO')) throw new ForbiddenException('Push móvil es exclusivo de alumnos');
    if (!user.sid) throw new UnauthorizedException('Inicia sesión nuevamente');
    return this.ds.transaction(async (manager) => {
      const repo = manager.getRepository(PushDispositivo);
      // El token del dispositivo cambia de cuenta al iniciar sesión en el mismo teléfono.
      const anterior = await repo.findOne({ where: { token: dto.token }, lock: { mode: 'pessimistic_write' } });
      await repo.update({ usuarioId: user.sub, instalacionId: dto.instalacionId }, { activo: false });
      const dispositivo = anterior ?? repo.create();
      Object.assign(dispositivo, dto, { usuarioId: user.sub, sesionId: user.sid, activo: true, actualizadoEn: new Date() });
      await repo.save(dispositivo);
      return { registrado: true, habilitado: this.config.get('PUSH_ENABLED') === 'true' };
    });
  }
  async retirar(instalacionId: string, user: JwtUser) {
    await this.ds.getRepository(PushDispositivo).update({ usuarioId: user.sub, instalacionId }, { activo: false });
    return { ok: true };
  }
  async encolar(notificacion: Notificacion) {
    const dispositivos = await this.ds.getRepository(PushDispositivo).find({ where: { usuarioId: notificacion.usuarioId, activo: true } });
    await this.ds.transaction(async (manager) => {
      // Serializa la cola por notificación para impedir duplicados también entre procesos.
      const actual = await manager.getRepository(Notificacion).findOne({ where: { id: notificacion.id }, lock: { mode: 'pessimistic_write' } });
      if (!actual) return;
      if (!actual.pushPendiente) return;
      const repo = manager.getRepository(PushEnvio);
      for (const d of dispositivos) if (!await repo.existsBy({ notificacionId: actual.id, dispositivoId: d.id })) await repo.insert({ notificacionId: actual.id, dispositivoId: d.id, estado: 'PENDIENTE', intentos: 0, proximoIntento: new Date(), ticketId: null, error: null });
      await manager.getRepository(Notificacion).update(actual.id, { pushPendiente: false });
    });
  }
  async recuperar() {
    const pendientes = await this.ds.getRepository(Notificacion).find({ where: { pushPendiente: true }, order: { id: 'ASC' }, take: 50 });
    for (const n of pendientes) {
      try { await this.encolar(n); } catch { this.logger.warn('Cola push pendiente; se reintentará sin perder la notificación'); }
    }
  }
  async procesar() {
    if (this.trabajando || this.config.get('PUSH_ENABLED') !== 'true') return;
    this.trabajando = true;
    try {
      const repo = this.ds.getRepository(PushEnvio);
      const pendientes = await repo.find({ where: { estado: In(['PENDIENTE', 'PROCESANDO']), proximoIntento: LessThan(new Date()) }, order: { id: 'ASC' }, take: 50 });
      for (const candidato of pendientes) {
        const reclamado = await this.ds.transaction(async (manager) => {
          const r = manager.getRepository(PushEnvio);
          const envio = await r.findOne({ where: { id: candidato.id }, lock: { mode: 'pessimistic_write' } });
          if (!envio || !['PENDIENTE', 'PROCESANDO'].includes(envio.estado) || envio.proximoIntento > new Date()) return null;
          if (envio.intentos >= 3) { await r.update(envio.id, { estado: 'ERROR', error: 'REINTENTOS_AGOTADOS' }); return null; }
          envio.estado = 'PROCESANDO'; envio.intentos++; envio.proximoIntento = new Date(Date.now() + 120000);
          return r.save(envio);
        });
        if (!reclamado) continue;
        const dispositivo = await this.ds.getRepository(PushDispositivo).findOneBy({ id: reclamado.dispositivoId, activo: true });
        const usuario = dispositivo ? await this.ds.getRepository(Usuario).findOneBy({ id: dispositivo.usuarioId, activo: true }) : null;
        const sesion = dispositivo ? await this.ds.getRepository(Sesion).findOneBy({ id: dispositivo.sesionId, usuarioId: dispositivo.usuarioId, revocada: false }) : null;
        const notificacion = await this.ds.getRepository(Notificacion).findOneBy({ id: reclamado.notificacionId });
        if (!dispositivo || !usuario || !sesion || sesion.version !== usuario.sessionVersion || sesion.expiraEn <= new Date() || !notificacion || notificacion.usuarioId !== dispositivo.usuarioId) {
          await repo.update(reclamado.id, { estado: 'OMITIDO', error: 'SESION_INACTIVA' }); continue;
        }
        try {
          const respuesta = await axios.post<{ data: { status: string; id?: string; details?: { error?: string } } }>('https://exp.host/--/api/v2/push/send', {
            to: dispositivo.token, title: 'Sistema Escolar', body: 'Tienes una nueva notificación. Abre la app para consultarla.', data: { notificacionId: notificacion.id }, sound: 'default',
          }, { timeout: 15000, headers: { ...(this.config.get<string>('EXPO_ACCESS_TOKEN') ? { Authorization: `Bearer ${this.config.get<string>('EXPO_ACCESS_TOKEN')}` } : {}) } });
          const ticket = respuesta.data.data;
          if (ticket.status === 'ok' && ticket.id) await repo.update(reclamado.id, { estado: 'ACEPTADO', ticketId: ticket.id, error: null, proximoIntento: new Date(Date.now() + 15 * 60000) });
          else {
            const error = ticket.details?.error === 'DeviceNotRegistered' ? 'DEVICE_NOT_REGISTERED' : 'PROVEEDOR_RECHAZO';
            if (error === 'DEVICE_NOT_REGISTERED') await this.ds.getRepository(PushDispositivo).update(dispositivo.id, { activo: false });
            await repo.update(reclamado.id, { estado: 'ERROR', error });
          }
        } catch { await repo.update(reclamado.id, { estado: 'PENDIENTE', error: 'PROVEEDOR_NO_DISPONIBLE', proximoIntento: new Date(Date.now() + 120000) }); }
      }
      await this.recibos();
    } finally { this.trabajando = false; }
  }
  private async recibos() {
    const repo = this.ds.getRepository(PushEnvio);
    const envios = await repo.find({ where: { estado: 'ACEPTADO', proximoIntento: LessThan(new Date()) }, take: 50 });
    if (!envios.length) return;
    const { data } = await axios.post<{ data: Record<string, { status: string; details?: { error?: string } }> }>('https://exp.host/--/api/v2/push/getReceipts', { ids: envios.map((e) => e.ticketId) }, {
      timeout: 15000, headers: this.config.get<string>('EXPO_ACCESS_TOKEN') ? { Authorization: `Bearer ${this.config.get<string>('EXPO_ACCESS_TOKEN')}` } : {},
    });
    for (const envio of envios) {
      const recibo = data.data[envio.ticketId ?? ''];
      if (!recibo) { await repo.update(envio.id, envio.intentos >= 99 ? { estado: 'ERROR', error: 'RECIBO_NO_DISPONIBLE' } : { intentos: envio.intentos + 1, proximoIntento: new Date(Date.now() + 15 * 60000) }); continue; }
      if (recibo.details?.error === 'DeviceNotRegistered') await this.ds.getRepository(PushDispositivo).update(envio.dispositivoId, { activo: false });
      await repo.update(envio.id, { estado: recibo.status === 'ok' ? 'CONFIRMADO' : 'ERROR', error: recibo.status === 'ok' ? null : 'RECIBO_RECHAZADO' });
    }
  }
}
