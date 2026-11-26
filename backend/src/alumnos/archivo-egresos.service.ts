import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import { gzipSync } from 'zlib';
import { DataSource, LessThanOrEqual } from 'typeorm';
import {EgresoAlumno} from '../entities/egreso-alumno.entity';
import {expedienteHistorico} from './expediente-historico';
const DIA = 86_400_000;

/**
 * Exporta una instantánea verificable por egreso. Nunca elimina tablas, notas
 * ni expedientes originales. Un archivo no es prueba de restauración.
 */
@Injectable()
export class ArchivoEgresosService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private ejecutando = false;
  private readonly logger = new Logger(ArchivoEgresosService.name);

  constructor(
    private readonly ds: DataSource,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    if (this.config.get<string>('EGRESOS_ARCHIVO_AUTOMATICO') !== 'true') return;
    if (!this.config.get<string>('EGRESOS_ARCHIVE_DIR')) {
      throw new Error('EGRESOS_ARCHIVE_DIR obligatorio cuando el archivo automático está habilitado');
    }
    this.timer = setInterval(() => {
      void this.procesar().catch(() => this.logger.warn('El archivo de egresos requiere revisión'));
    }, DIA);
    this.timer.unref();
    void this.procesar().catch(() => this.logger.warn('No se completó el archivo inicial de egresos'));
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async procesar(): Promise<number> {
    if (this.ejecutando || this.config.get<string>('EGRESOS_ARCHIVO_AUTOMATICO') !== 'true') return 0;
    this.ejecutando = true;
    let procesados = 0;
    try {
      const ids = await this.ds.getRepository(EgresoAlumno).find({
        select: { id: true },
        where: { estadoArchivo: 'VIGENTE', archivarDesde: LessThanOrEqual(new Date()) },
        order: { archivarDesde: 'ASC', id: 'ASC' },
        take: 10,
      });
      for (const candidato of ids) {
        try {
          const archivado = await this.archivar(candidato.id);
          if (archivado) procesados++;
        } catch {
          this.logger.warn('Archivo de egreso pendiente: revisar almacenamiento, base de datos y permisos');
        }
      }
    } finally {
      this.ejecutando = false;
    }
    return procesados;
  }

  private async archivar(id: number): Promise<boolean> {
    return this.ds.transaction(async (manager) => {
      const repo = manager.getRepository(EgresoAlumno);
      const egreso = await repo.findOne({
        where: { id },
        relations: { alumno: true, ciclo: true },
        lock: { mode: 'pessimistic_write' },
      });
      if (!egreso || egreso.estadoArchivo !== 'VIGENTE' || egreso.archivarDesde > new Date()) return false;
      const alumno = egreso.alumno;
      if (alumno.estatus !== 'EGRESADO') throw new Error('Inconsistencia del estado de egreso');

      const expediente=await expedienteHistorico(manager,egreso,true);
      const raiz = resolve(this.config.getOrThrow<string>('EGRESOS_ARCHIVE_DIR'));
      const clave = egreso.ciclo.clave.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 20);
      const carpeta = join(raiz, 'ciclo_' + egreso.cicloId + '_' + clave);
      await mkdir(carpeta, { recursive: true, mode: 0o700 });
      const destino = join(carpeta, 'egreso_' + egreso.id + '.json.gz');
      const temporal = destino + '.' + randomUUID() + '.tmp';
      const comprimido = gzipSync(Buffer.from(JSON.stringify(expediente), 'utf8'));
      const sha = createHash('sha256').update(comprimido).digest('hex');
      try {
        await writeFile(temporal, comprimido, { flag: 'wx', mode: 0o600 });
        await rename(temporal, destino);
      } finally {
        await rm(temporal, { force: true }).catch(() => undefined);
      }
      const verificado = await readFile(destino);
      if (createHash('sha256').update(verificado).digest('hex') !== sha) {
        throw new Error('Error de integridad del archivo generado');
      }
      await repo.update(egreso.id, {
        estadoArchivo: 'ARCHIVADO',
        rutaArchivo: join('ciclo_' + egreso.cicloId + '_' + clave, 'egreso_' + egreso.id + '.json.gz'),
        sha256Archivo: sha,
        archivadoEn: new Date(),
      });
      return true;
    });
  }
}
