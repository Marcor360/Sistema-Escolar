import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DataSource, LessThan } from 'typeorm';
import { Sesion } from '../entities/sesion.entity';
/** Retiene 30 días tras expirar para diagnóstico; los accesos ya son rechazados inmediatamente. */
@Injectable()
export class SesionesLimpiezaService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private ejecutando = false;
  private readonly logger = new Logger(SesionesLimpiezaService.name);
  constructor(private readonly ds: DataSource) {}
  onModuleInit() { this.timer = setInterval(() => { void this.limpiar().catch(() => this.logger.warn('No se pudo limpiar sesiones expiradas')); }, 86400000); this.timer.unref(); }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
  async limpiar(ahora = new Date()) {
    if (this.ejecutando) return { eliminadas: 0 };
    this.ejecutando = true;
    try { const resultado = await this.ds.getRepository(Sesion).delete({ expiraEn: LessThan(new Date(ahora.getTime() - 30 * 86400000)) }); return { eliminadas: resultado.affected ?? 0 }; }
    finally { this.ejecutando = false; }
  }
}
