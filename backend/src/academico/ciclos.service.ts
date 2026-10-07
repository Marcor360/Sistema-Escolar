import { Grupo } from '../entities/grupo.entity';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { CicloEscolar } from '../entities/ciclo-escolar.entity';
import { GrupoMateria } from '../entities/grupo-materia.entity';
import { Inscripcion } from '../entities/inscripcion.entity';
import { Calificacion } from '../entities/calificacion.entity';
import { PeriodoCalificacion } from '../entities/periodo-calificacion.entity';
import { BitacoraAcademica } from '../entities/bitacora-academica.entity';
import { JwtUser } from '../common/current-user.decorator';

@Injectable()
export class CiclosService {
  constructor(private readonly dataSource: DataSource) {}

  async resumen(id: number) {
    return this.dataSource.transaction((manager) => this.resumenCon(manager, id));
  }

  private async resumenCon(manager: import('typeorm').EntityManager, id: number) {
    const ciclo = await manager.getRepository(CicloEscolar).findOneBy({ id });
    if (!ciclo) throw new NotFoundException('Ciclo no encontrado');
    const clases = await manager.getRepository(GrupoMateria).find({ where: { grupo: { cicloId: id, activo: true } } });
    const grupos = await manager.getRepository(Grupo).find({ where: { cicloId: id, activo: true } });
    const grupoIds = grupos.map((g) => g.id);
    const inscripciones = grupoIds.length ? await manager.getRepository(Inscripcion).find({ where: { grupoId: In(grupoIds), estatus: 'ACTIVA', alumno: { estatus: 'ACTIVO' } } }) : [];
    const periodos = clases.length ? await manager.getRepository(PeriodoCalificacion).find({ where: { grupoMateriaId: In(clases.map((c) => c.id)) } }) : [];
    const notas = clases.length ? await manager.getRepository(Calificacion).find({ where: { grupoMateriaId: In(clases.map((c) => c.id)) } }) : [];
    const faltantes: { grupoId?: number; grupoMateriaId: number; parcial: number; inscritos: number; sinNota: number; cerrado: boolean }[] = [];
    for (const grupo of grupos) {
      const inscritos = inscripciones.filter((i) => i.grupoId === grupo.id).length;
      if (inscritos && !clases.some((c) => c.grupoId === grupo.id)) faltantes.push({ grupoId: grupo.id, grupoMateriaId: 0, parcial: 0, inscritos, sinNota: inscritos, cerrado: false });
    }
    for (const clase of clases) for (const parcial of [1, 2, 3]) {
      const inscritos = inscripciones.filter((i) => i.grupoId === clase.grupoId);
      const sinNota = inscritos.filter((i) => !notas.some((n) => n.grupoMateriaId === clase.id && n.parcial === parcial && n.alumnoId === i.alumnoId)).length;
      const cerrado = periodos.some((p) => p.grupoMateriaId === clase.id && p.parcial === parcial && p.estatus === 'CERRADO');
      if (inscritos.length && (sinNota || !cerrado)) faltantes.push({ grupoMateriaId: clase.id, parcial, inscritos: inscritos.length, sinNota, cerrado });
    }
    return { ciclo, grupos: grupoIds.length, clases: clases.length, inscritos: inscripciones.length, faltantes, puedeCerrar: faltantes.length === 0 };
  }

  async transicion(id: number, accion: 'activar' | 'iniciar-cierre' | 'cerrar', confirmado: boolean, user: JwtUser) {
    if (!confirmado) throw new BadRequestException('Confirma explícitamente la transición del ciclo');
    try { return await this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      const repo = manager.getRepository(CicloEscolar);
      const ciclo = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!ciclo) throw new NotFoundException('Ciclo no encontrado');
      if (accion === 'activar') {
        if (ciclo.activo || ciclo.estado !== 'PREPARACION') throw new ConflictException('Solo se activa un ciclo en preparación');
        if (await repo.count({ where: { activo: true } })) throw new ConflictException('Cierra formalmente el ciclo vigente antes de activar otro');
        ciclo.estado = 'ACTIVO'; ciclo.activo = true;
      } else if (accion === 'iniciar-cierre') {
        if (!ciclo.activo || ciclo.estado !== 'ACTIVO') throw new ConflictException('El ciclo no está activo');
        if ((await this.resumenCon(manager, id)).faltantes.some((f) => f.parcial === 0)) throw new ConflictException('Asigna las materias a los grupos inscritos antes de iniciar el cierre');
        ciclo.estado = 'EN_CIERRE';
      } else {
        if (!ciclo.activo || ciclo.estado !== 'EN_CIERRE') throw new ConflictException('Inicia el cierre antes de cerrar el ciclo');
        const resumen = await this.resumenCon(manager, id);
        if (!resumen.puedeCerrar) throw new ConflictException('Hay notas faltantes o parciales abiertos; consulta el resumen de cierre');
        ciclo.estado = 'CERRADO'; ciclo.activo = false;
      }
      await repo.save(ciclo);
      await manager.getRepository(BitacoraAcademica).insert({ usuarioId: user.sub, plantelId: null, accion: `CICLO_${accion.toUpperCase().replace('-', '_')}`, entidadId: id, detalle: `estado=${ciclo.estado}`, fecha: new Date() });
      return ciclo;
    }); } catch (error) {
      const e = error as { code?: string; errno?: number; number?: number; driverError?: { number?: number }; originalError?: { info?: { number?: number } } };
      if (e?.code === 'ER_LOCK_DEADLOCK' || e?.code === 'ER_LOCK_WAIT_TIMEOUT' || e?.errno === 1213 || e?.number === 1205 || e?.driverError?.number === 1205 || e?.originalError?.info?.number === 1205) throw new ConflictException('El ciclo cambió concurrentemente; vuelve a consultar');
      throw error;
    }
  }
}
