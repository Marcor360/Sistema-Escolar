import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DataSource, EntityManager, LessThan } from 'typeorm';
import { unlink } from 'fs/promises';
import { resolve } from 'path';
import { ArchivoLimpieza } from '../entities/archivo-limpieza.entity';
import { uploadsPath } from '../common/uploads-path';
export async function programarLimpieza(manager: EntityManager, ruta: string) {
  if (!/^\/uploads\/[^/\\]+$/.test(ruta)) return;
  const nombre = ruta.slice('/uploads/'.length);
  if (!nombre || ['.', '..'].includes(nombre) || nombre.length > 200) return;
  const repo = manager.getRepository(ArchivoLimpieza);
  if (!await repo.existsBy({ nombre })) await repo.insert({ nombre, intentos: 0, proximoIntento: new Date(0), error: null });
}
/** Cola persistida junto con la sustitución/baja. Un fallo de disco nunca pierde la referencia a limpiar. */
@Injectable()
export class ArchivoLimpiezaService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>; private trabajando = false;
  private readonly logger = new Logger(ArchivoLimpiezaService.name);
  constructor(private readonly ds: DataSource) {}
  onModuleInit() { this.timer = setInterval(() => { void this.procesar().catch(() => this.logger.warn('No se pudo procesar limpieza de archivos')); }, 60000); this.timer.unref(); }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
  async procesar() {
    if (this.trabajando) return; this.trabajando = true;
    try {
      const pendientes = await this.ds.getRepository(ArchivoLimpieza).find({ where: { proximoIntento: LessThan(new Date()) }, order: { id: 'ASC' }, take: 25 });
      for (const candidato of pendientes) await this.ds.transaction(async (manager) => {
        const repo = manager.getRepository(ArchivoLimpieza); const fila = await repo.findOne({ where: { id: candidato.id }, lock: { mode: 'pessimistic_write' } });
        if (!fila || fila.proximoIntento > new Date()) return;
        if (['.', '..'].includes(fila.nombre) || /[/\\]/.test(fila.nombre)) { await repo.update(fila.id, { error: 'RUTA_INVALIDA', proximoIntento: new Date(Date.now() + 86400000) }); return; }
        try { await unlink(resolve(uploadsPath(), fila.nombre)); await repo.delete(fila.id); }
        catch (e) {
          if ((e as { code?: string }).code === 'ENOENT') await repo.delete(fila.id);
          else { await repo.update(fila.id, { intentos: fila.intentos + 1, error: 'ALMACENAMIENTO_NO_DISPONIBLE', proximoIntento: new Date(Date.now() + 5 * 60000) }); this.logger.warn('Limpieza pendiente por fallo de almacenamiento; revisar ACL/disco'); }
        }
      });
    } finally { this.trabajando = false; }
  }
}
