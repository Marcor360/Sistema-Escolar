import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager, LessThan } from 'typeorm';
import { AuthCorreoEvento, TipoEventoSeguridad } from '../entities/auth-correo-evento.entity';
import { Usuario } from '../entities/usuario.entity';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { ConfiguracionService } from '../configuracion/configuracion.service';
import { plantillaEventoSeguridad } from '../notificaciones/plantillas-correo';

const LEASE_MS = 120_000;
const MAX_INTENTOS = 5;

@Injectable()
export class AuthCorreoEventosService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuthCorreoEventosService.name);
  private reloj?: ReturnType<typeof setInterval>;
  private procesando?: Promise<number>;

  constructor(private readonly ds: DataSource, private readonly correo: NotificacionesService, private readonly marca: ConfiguracionService) {}

  onModuleInit() {
    if (process.env.AUTH_OUTBOX_WORKER === 'false') return;
    this.reloj = setInterval(() => {
      void this.procesar().catch(() => this.logger.warn('Avisos de seguridad: ciclo no disponible'));
    }, 5000);
    this.reloj.unref();
  }

  async onModuleDestroy() {
    if (this.reloj) clearInterval(this.reloj);
    await this.procesando;
  }

  /** No almacena correos, contraseñas, códigos ni datos sensibles en la cola. */
  async encolar(usuarioId: number, tipo: TipoEventoSeguridad, id: string = randomUUID()) {
    await this.encolarEnTransaccion(this.ds.manager, usuarioId, tipo, id);
  }

  async encolarEnTransaccion(manager: EntityManager, usuarioId: number, tipo: TipoEventoSeguridad, id: string = randomUUID()) {
    await manager.getRepository(AuthCorreoEvento).insert({
      id, usuarioId, tipo, estado: 'PENDIENTE', intentos: 0,
      proximoIntento: new Date(Math.floor(Date.now() / 1000) * 1000), leaseHasta: null, claim: null,
    });
  }

  procesar(): Promise<number> {
    if (this.procesando) return this.procesando;
    this.procesando = this.ciclo().finally(() => { this.procesando = undefined; });
    return this.procesando;
  }

  private async ciclo(): Promise<number> {
    const repo = this.ds.getRepository(AuthCorreoEvento), ahora = new Date();
    await repo.delete({ estado: 'ENVIADO', createdAt: LessThan(new Date(ahora.getTime() - 30 * 86400000)) });
    // Un proceso puede morir después de reclamar su último intento. No dejar
    // ese evento PROCESANDO para siempre ni reclamar un lease todavía vigente.
    await repo.createQueryBuilder().update().set({ estado: 'FALLIDO', claim: null, leaseHasta: null })
      .where('estado = :estado AND lease_hasta <= :ahora AND intentos >= :max', {
        estado: 'PROCESANDO', ahora, max: MAX_INTENTOS,
      }).execute();
    const candidatos = await repo.createQueryBuilder('e')
      .where('(e.estado = :pendiente OR (e.estado = :procesando AND e.lease_hasta <= :ahora))', {
        pendiente: 'PENDIENTE', procesando: 'PROCESANDO', ahora,
      })
      .andWhere('e.proximo_intento <= :ahora AND e.intentos < :max', { ahora, max: MAX_INTENTOS })
      .orderBy('e.proximo_intento', 'ASC').addOrderBy('e.id', 'ASC').take(10).getMany();
    let procesados = 0;
    for (const candidato of candidatos) {
      const claim = randomUUID(), instante = new Date();
      const reserva = await repo.createQueryBuilder().update().set({
        estado: 'PROCESANDO', claim, leaseHasta: new Date(instante.getTime() + LEASE_MS),
        intentos: () => 'intentos + 1',
      }).where('id = :id AND intentos < :max AND proximo_intento <= :ahora AND (estado = :pendiente OR (estado = :procesando AND lease_hasta <= :ahora))', {
        id: candidato.id, max: MAX_INTENTOS, ahora: instante, pendiente: 'PENDIENTE', procesando: 'PROCESANDO',
      }).execute();
      if (reserva.affected !== 1) continue;
      procesados++;
      let renovando: Promise<unknown> = Promise.resolve();
      const latido = setInterval(() => {
        renovando = renovando.then(() => repo.update(
          { id: candidato.id, claim, estado: 'PROCESANDO' },
          { leaseHasta: new Date(Date.now() + LEASE_MS) },
        )).catch(() => undefined);
      }, 30000);
      latido.unref();
      try {
        const usuario = await this.ds.getRepository(Usuario).findOne({ where: { id: candidato.usuarioId, activo: true } });
        if (!usuario?.email) {
          await repo.update({ id: candidato.id, claim }, { estado: 'FALLIDO', claim: null, leaseHasta: null });
          continue;
        }
        const marca = await this.marca.obtener();
        const plantilla = plantillaEventoSeguridad(candidato.tipo, marca);
        const enviado = await this.correo.enviarEmail(usuario.email, plantilla.asunto, plantilla.html);
        if (enviado.simulado || enviado.omitido) throw new Error('ENVIO_NO_CONFIRMADO');
        await repo.update({ id: candidato.id, claim, estado: 'PROCESANDO' }, { estado: 'ENVIADO', claim: null, leaseHasta: null });
        this.logger.log(`Aviso de seguridad aceptado por proveedor id=${candidato.id}`);
      } catch {
        const estado = candidato.intentos + 1 >= MAX_INTENTOS ? 'FALLIDO' : 'PENDIENTE';
        await repo.update({ id: candidato.id, claim, estado: 'PROCESANDO' }, {
          estado, claim: null, leaseHasta: null,
          proximoIntento: new Date(Date.now() + Math.min(300_000, 15_000 * 2 ** candidato.intentos)),
        });
        this.logger.warn(`Aviso de seguridad id=${candidato.id} estado=${estado}`);
      } finally {
        clearInterval(latido);
        await renovando;
      }
    }
    return procesados;
  }
}
