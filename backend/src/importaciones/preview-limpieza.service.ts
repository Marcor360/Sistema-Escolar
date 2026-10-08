import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DataSource, LessThan } from 'typeorm';
import { ImportacionPreview } from '../entities';
/** El borrado en cascada retira también las filas cifradas; no registra datos del archivo. */
@Injectable()
export class PreviewLimpiezaService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private ejecutando = false;
  private readonly logger = new Logger(PreviewLimpiezaService.name);
  constructor(private readonly ds: DataSource) {}
  onModuleInit() { this.timer = setInterval(() => { void this.limpiar(); }, 60_000); this.timer.unref(); void this.limpiar(); }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
  async limpiar() {
    if (this.ejecutando || !this.ds.isInitialized) return;
    this.ejecutando = true;
    try { await this.ds.getRepository(ImportacionPreview).delete({ expira: LessThan(new Date()) }); }
    catch { this.logger.warn('No se pudieron retirar previsualizaciones expiradas; se reintentará'); }
    finally { this.ejecutando = false; }
  }
}
