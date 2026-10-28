import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import { gzipSync } from 'zlib';
import { DataSource, In, LessThanOrEqual } from 'typeorm';
import { GrupoMateria } from '../entities/grupo-materia.entity';
import { EgresoAlumno } from '../entities/egreso-alumno.entity';
import { Inscripcion } from '../entities/inscripcion.entity';
import { Calificacion } from '../entities/calificacion.entity';
import { HistorialCalificacion } from '../entities/historial-calificacion.entity';
import { ParticipacionAsignatura } from '../entities/participacion-asignatura.entity';
import { CalificacionRecursamiento, HistorialRecursamiento } from '../entities/calificacion-recursamiento.entity';

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

      const inscripciones = await manager.getRepository(Inscripcion).find({
        where: { alumnoId: alumno.id },
        order: { id: 'ASC' },
      });
      const calificaciones = await manager.getRepository(Calificacion).find({
        where: { alumnoId: alumno.id },
        order: { id: 'ASC' },
      });
      const revisiones = await manager.getRepository(HistorialCalificacion).find({
        where: { alumnoId: alumno.id },
        order: { id: 'ASC' },
      });
      const participaciones = await manager.getRepository(ParticipacionAsignatura).find({
        where: { alumnoId: alumno.id },
        order: { id: 'ASC' },
      });
      const participacionIds = participaciones.map((p) => p.id);
      const notasRecursamiento = participacionIds.length
        ? await manager.getRepository(CalificacionRecursamiento).find({
            where: { participacionId: In(participacionIds) },
            order: { id: 'ASC' },
          })
        : [];
      const revisionesRecursamiento = participacionIds.length
        ? await manager.getRepository(HistorialRecursamiento).find({
            where: { participacionId: In(participacionIds) },
            order: { id: 'ASC' },
          })
        : [];

      const claseIds = [...new Set([...calificaciones.map(c=>c.grupoMateriaId),...revisiones.map(r=>r.grupoMateriaId),...participaciones.map(p=>p.grupoMateriaId)])];
      const clases = claseIds.length ? await manager.getRepository(GrupoMateria).find({where:{id:In(claseIds)},select:{id:true,regimenEvaluacion:true},loadEagerRelations:false}) : [];
      const regimenes = new Map(clases.map(c=>[c.id,c.regimenEvaluacion]));
      const clasesRecursadas = new Map(participaciones.map(p=>[p.id,p.grupoMateriaId]));
      const expediente = {
        esquema: 'expediente-egreso-iua/v2',
        exportadoEn: new Date().toISOString(),
        egreso: {
          id: egreso.id,
          cicloId: egreso.cicloId,
          cicloClave: egreso.ciclo.clave,
          fechaEgreso: egreso.fechaEgreso,
          fechaDocumental: egreso.fechaDocumental ?? null,
        },
        alumno: {
          id: alumno.id,
          matricula: alumno.matricula,
          curp: alumno.curp,
          plantelId: alumno.plantelId,
          fechaNacimiento: alumno.fechaNacimiento,
          estatus: alumno.estatus,
          nombre: alumno.usuario.nombre,
          apellidoPaterno: alumno.usuario.apellidoPaterno,
          apellidoMaterno: alumno.usuario.apellidoMaterno,
        },
        inscripciones: inscripciones.map((i) => ({
          id: i.id,
          grupoId: i.grupoId,
          cicloId: i.grupo.cicloId,
          fechaInscripcion: i.fechaInscripcion,
          estatus: i.estatus,
        })),
        regimenesEvaluacion: clases.map(c=>({grupoMateriaId:c.id,regimenEvaluacion:c.regimenEvaluacion})),
        calificaciones: calificaciones.map((c) => ({
          id: c.id,
          grupoMateriaId: c.grupoMateriaId,
          parcial: c.parcial,
          calificacion: c.calificacion,
          escalaMaxima: c.escalaMaxima ?? 100,
          capturadaPorId: c.capturadaPorId,
          regimenEvaluacion: regimenes.get(c.grupoMateriaId) ?? null,
          observaciones: c.observaciones,
          updatedAt: c.updatedAt,
        })),
        revisiones: revisiones.map((r) => ({
          id: r.id,
          calificacionId: r.calificacionId,
          grupoMateriaId: r.grupoMateriaId,
          parcial: r.parcial,
          valorAnterior: r.valorAnterior,
          valorNuevo: r.valorNuevo,
          escalaAnterior: r.escalaAnterior ?? 100,
          escalaNueva: r.escalaNueva ?? 100,
          detalleCalculo: r.detalleCalculo ?? null,
          usuarioId: r.usuarioId,
          observacionAnterior: r.observacionAnterior,
          observacionNueva: r.observacionNueva,
          regimenEvaluacion: regimenes.get(r.grupoMateriaId) ?? null,
          motivo: r.motivo,
          fecha: r.fecha,
        })),
        recursamientos: participaciones.map((p) => ({
          id: p.id,
          grupoMateriaId: p.grupoMateriaId,
          intento: p.intento,
          regimenEvaluacion: regimenes.get(p.grupoMateriaId) ?? null,
          estado: p.estado,
        })),
        notasRecursamiento: notasRecursamiento.map((n) => ({
          participacionId: n.participacionId,
          parcial: n.parcial,
          calificacion: n.calificacion,
          escalaMaxima: n.escalaMaxima ?? 100,
          capturadaPorId: n.capturadaPorId,
          regimenEvaluacion: regimenes.get(clasesRecursadas.get(n.participacionId)!) ?? null,
        })),
        revisionesRecursamiento: revisionesRecursamiento.map((r) => ({
          participacionId: r.participacionId,
          parcial: r.parcial,
          anterior: r.anterior,
          usuarioId: r.usuarioId,
          nueva: r.nueva,
          escalaAnterior: r.escalaAnterior ?? 100,
          escalaNueva: r.escalaNueva ?? 100,
          regimenEvaluacion: regimenes.get(clasesRecursadas.get(r.participacionId)!) ?? null,
          motivo: r.motivo,
          fecha: r.createdAt,
        })),
      };

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
