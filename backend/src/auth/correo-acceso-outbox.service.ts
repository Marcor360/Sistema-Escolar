import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'crypto';
import { DataSource, In, LessThan, MoreThan } from 'typeorm';
import { AuthCorreoOutbox, TipoCorreoAcceso } from '../entities/auth-correo-outbox.entity';
import { ActivacionToken } from '../entities/activacion-token.entity';
import { PasswordResetToken } from '../entities/password-reset-token.entity';
import { Usuario } from '../entities/usuario.entity';
import { Alumno } from '../entities/alumno.entity';
import { UsuarioPlantel } from '../entities/usuario-plantel.entity';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { plantillaInvitacion, plantillaRecuperacion } from '../notificaciones/plantillas-correo';
import { ClavesCorreoAcceso } from './correo-acceso-claves';

const VIGENCIA_MS = 3600000;
const LEASE_MS = 120000; // Mayor que el socketTimeout SMTP (30 s); se renueva mientras se envía.
const MAX_INTENTOS = 6;
const ABIERTOS = ['PENDIENTE', 'PROCESANDO'] as const;

@Injectable()
export class CorreoAccesoOutboxService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CorreoAccesoOutboxService.name);
  private readonly claves: ClavesCorreoAcceso;
  private timer?: ReturnType<typeof setInterval>;
  private enCurso?: Promise<number>;
  private readonly retencionDias: number;
  constructor(private readonly ds: DataSource, private readonly correo: NotificacionesService, private readonly config: ConfigService) {
    this.claves = new ClavesCorreoAcceso(config);
    this.retencionDias = Number(config.get('AUTH_OUTBOX_RETENTION_DAYS') || 30);
    if (!Number.isInteger(this.retencionDias) || this.retencionDias < 1 || this.retencionDias > 365) throw new Error('AUTH_OUTBOX_RETENTION_DAYS debe ser 1..365');
  }
  onModuleInit() {
    if (this.config.get<string>('AUTH_OUTBOX_WORKER') === 'false') return;
    this.timer = setInterval(() => { void this.procesar().catch(() => this.logger.warn('OUTBOX ciclo fallido')); }, 5000);
    this.timer.unref();
  }
  async onModuleDestroy() { if (this.timer) clearInterval(this.timer); await this.enCurso; }

  /** Espera el commit duradero, nunca SMTP. La respuesta HTTP no distingue cuentas ni duplicados. */
  async solicitar(email: string, tipo: TipoCorreoAcceso): Promise<void> {
    const usuario = await this.ds.getRepository(Usuario).findOne({ where: { email, activo: true } });
    if (!usuario) return;
    await this.ds.transaction('READ COMMITTED', async manager => {
      const actual = await manager.getRepository(Usuario).findOne({ where: { id: usuario.id, activo: true }, lock: { mode: 'pessimistic_write' } });
      if (!actual || (actual.sessionVersion ?? 0) !== (usuario.sessionVersion ?? 0) || actual.activacionPendiente !== (tipo === 'ACTIVACION')) return;
      const repo = manager.getRepository(AuthCorreoOutbox);
      // Coalescer durante toda la vigencia, incluso si SMTP ya aceptó. No invalidar el primer código al reenviar.
      if (await repo.findOne({ where: { usuarioId: actual.id, tipo, version: actual.sessionVersion ?? 0, expiraEn: MoreThan(new Date()) } })) return;
      const ahora = new Date();
      await repo.insert({ id: randomUUID(), usuarioId: actual.id, tipo, version: actual.sessionVersion ?? 0,
        estado: 'PENDIENTE', intentos: 0, proximoIntento: ahora, expiraEn: new Date(ahora.getTime() + VIGENCIA_MS),
        claveId: null, tokenHash: null, claim: null, leaseHasta: null, errorCodigo: null });
    });
  }

  /** Máximo diez trabajos y un SMTP simultáneo por instancia; la DB coordina instancias. */
  procesar(): Promise<number> {
    if (this.enCurso) return this.enCurso;
    this.enCurso = this.ciclo().finally(() => { this.enCurso = undefined; });
    return this.enCurso;
  }
  private async ciclo() {
    const repo = this.ds.getRepository(AuthCorreoOutbox), ahora = new Date();
    await repo.createQueryBuilder().update().set({ estado: 'EXPIRADO', claim: null, leaseHasta: null })
      .where('estado IN (:...estados) AND expira_en <= :ahora', { estados: ABIERTOS, ahora }).execute();
    await repo.createQueryBuilder().update().set({ estado: 'FALLIDO', claim: null, leaseHasta: null })
      .where('estado IN (:...estados) AND intentos >= :max AND (lease_hasta IS NULL OR lease_hasta <= :ahora)', { estados: ABIERTOS, max: MAX_INTENTOS, ahora }).execute();
    await repo.delete({ expiraEn: LessThan(new Date(Date.now() - this.retencionDias * 86400000)) });
    const candidatos = await repo.createQueryBuilder('o').where('o.estado IN (:...estados)', { estados: ABIERTOS })
      .andWhere('o.expira_en > :ahora AND o.proximo_intento <= :ahora AND o.intentos < 6', { ahora })
      .andWhere('(o.lease_hasta IS NULL OR o.lease_hasta <= :ahora)', { ahora })
      .orderBy('o.proximo_intento', 'ASC').addOrderBy('o.id', 'ASC').take(10).getMany();
    let procesados = 0;
    for (const candidato of candidatos) {
      const claim = randomUUID(), instante = new Date();
      const reserva = await repo.createQueryBuilder().update().set({ estado: 'PROCESANDO', claim, leaseHasta: new Date(instante.getTime() + LEASE_MS), intentos: () => 'intentos + 1' })
        .where('id = :id AND estado IN (:...estados) AND expira_en > :ahora AND proximo_intento <= :ahora AND intentos < 6 AND (lease_hasta IS NULL OR lease_hasta <= :ahora)', { id: candidato.id, estados: ABIERTOS, ahora: instante }).execute();
      if (reserva.affected !== 1) continue;
      procesados++;
      await this.enviar(candidato.id, claim);
    }
    return procesados;
  }

  /** El hash se confirma ANTES de SMTP. Tras una caída se reconstruye exactamente el mismo código. */
  private async preparar(id: string, claim: string) {
    const referencia = await this.ds.getRepository(AuthCorreoOutbox).findOneByOrFail({ id });
    return this.ds.transaction('READ COMMITTED', async manager => {
      const usuario = await manager.getRepository(Usuario).findOne({ where: { id: referencia.usuarioId }, lock: { mode: 'pessimistic_write' } });
      const repo = manager.getRepository(AuthCorreoOutbox);
      const trabajo = await repo.findOne({ where: { id, claim, estado: 'PROCESANDO' }, lock: { mode: 'pessimistic_write' } });
      if (!trabajo) return null;
      if (!usuario?.activo || (usuario.sessionVersion ?? 0) !== trabajo.version || usuario.activacionPendiente !== (trabajo.tipo === 'ACTIVACION')) {
        await repo.update({ id, claim }, { estado: 'CANCELADO', claim: null, leaseHasta: null }); return null;
      }
      if (trabajo.expiraEn <= new Date() || trabajo.intentos > MAX_INTENTOS) {
        await repo.update({ id, claim }, { estado: trabajo.expiraEn <= new Date() ? 'EXPIRADO' : 'FALLIDO', claim: null, leaseHasta: null }); return null;
      }
      const nuevo = !trabajo.tokenHash;
      if (nuevo) trabajo.claveId = this.claves.activa;
      const token = this.claves.token(trabajo);
      const hash = createHash('sha256').update(token).digest('hex');
      const tokens = manager.getRepository(trabajo.tipo === 'ACTIVACION' ? ActivacionToken : PasswordResetToken);
      if (nuevo) {
        await tokens.update({ usuarioId: usuario.id, usado: false }, { usado: true });
        const datos = { usuarioId: usuario.id, token: hash, expiraEn: trabajo.expiraEn, usado: false };
        if (trabajo.tipo === 'ACTIVACION') await manager.getRepository(ActivacionToken).insert({ ...datos, id: randomUUID(), intentos: 0 });
        else await manager.getRepository(PasswordResetToken).insert(datos);
        trabajo.tokenHash = hash;
        await repo.update({ id, claim }, { tokenHash: hash, claveId: trabajo.claveId });
      } else {
        const vigente = await tokens.findOne({ where: { usuarioId: usuario.id, token: hash, usado: false, expiraEn: MoreThan(new Date()) } });
        if (trabajo.tokenHash !== hash || !vigente) {
          await repo.update({ id, claim }, { estado: 'CANCELADO', claim: null, leaseHasta: null }); return null;
        }
      }
      return { trabajo, usuario, token };
    });
  }

  private async enviar(id: string, claim: string) {
    const repo = this.ds.getRepository(AuthCorreoOutbox);
    let renovando: Promise<unknown> = Promise.resolve();
    const heartbeat = setInterval(() => {
      renovando = renovando.then(() => repo.update({ id, claim, estado: 'PROCESANDO' }, { leaseHasta: new Date(Date.now() + LEASE_MS) })).catch(() => undefined);
    }, 30000);
    heartbeat.unref();
    try {
      const listo = await this.preparar(id, claim);
      if (!listo) return;
      const { trabajo, usuario, token } = listo;
      // El reintento conserva Message-ID; SMTP es al menos una vez, nunca exactamente una vez.
      const from = this.config.get<string>('SMTP_FROM') || '';
      const dominio = from.trim().match(/@([a-z0-9.-]+)>?$/i)?.[1];
      const enviado = await this.correo.enviarEmail(usuario.email,
        trabajo.tipo === 'ACTIVACION' ? 'Activación de tu cuenta escolar' : 'Recuperación de contraseña',
        trabajo.tipo === 'ACTIVACION' ? plantillaInvitacion(token) : plantillaRecuperacion(token),
        dominio ? `acceso-${trabajo.id}@${dominio}` : undefined);
      if (enviado.simulado) throw new Error('SMTP_NO_DISPONIBLE');
      const actualizado = await repo.update({ id, claim, estado: 'PROCESANDO' }, { estado: 'ACEPTADO', errorCodigo: null, claim: null, leaseHasta: null });
      this.logger.log(`OUTBOX id=${id} estado=ACEPTADO_SMTP`);
      if (actualizado.affected === 1 && trabajo.tipo === 'RECUPERACION') {
        await this.notificarAyudaPlantel(usuario).catch(() => this.logger.warn(`OUTBOX id=${id} aviso_plantel_fallido`));
      }
    } catch {
      const trabajo = await repo.findOneBy({ id, claim, estado: 'PROCESANDO' });
      if (trabajo) {
        const estado = trabajo.expiraEn <= new Date() ? 'EXPIRADO' : trabajo.intentos >= MAX_INTENTOS ? 'FALLIDO' : 'PENDIENTE';
        await repo.update({ id, claim, estado: 'PROCESANDO' }, { estado, errorCodigo: 'ENVIO_NO_CONFIRMADO', claim: null, leaseHasta: null,
          proximoIntento: new Date(Date.now() + Math.min(300000, 15000 * 2 ** (trabajo.intentos - 1))) });
        this.logger.warn(`OUTBOX id=${id} estado=${estado} intento=${trabajo.intentos}`);
      }
    } finally { clearInterval(heartbeat); await renovando; }
  }

  private async notificarAyudaPlantel(usuario: Usuario) {
    const alumno = await this.ds.getRepository(Alumno).findOne({ where: { usuarioId: usuario.id } });
    const asignaciones = alumno ? [] : await this.ds.getRepository(UsuarioPlantel).find({ where: { usuarioId: usuario.id, activo: true } });
    const ids = alumno ? [alumno.plantelId] : asignaciones.map(a => a.plantelId);
    if (!ids.length) return;
    const responsables = await this.ds.getRepository(UsuarioPlantel).find({ where: { plantelId: In(ids), activo: true }, relations: { usuario: true } });
    const correos = [...new Set(responsables.filter(a => a.usuario.activo && a.usuario.roles.some(r => r.clave === 'ADMINISTRATIVO')).map(a => a.usuario.email))];
    const solicitante = usuario.email.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
    for (const email of correos) await this.correo.enviarEmail(email, 'IUA · Solicitud de apoyo para acceso',
      '<p>Se registró una solicitud de recuperación de acceso en uno de tus planteles.</p>' +
      `<p>Cuenta institucional solicitante: <strong>${solicitante}</strong></p>` +
      '<p>Ingresa al portal administrativo y consulta la sección Usuarios para identificar al titular y, si corresponde, emitir una contraseña temporal.</p>' +
      '<p>Esta notificación no incluye códigos ni contraseñas. Verifica la identidad del solicitante antes de realizar cambios.</p>');
  }
}
