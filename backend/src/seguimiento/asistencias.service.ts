import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { createHash } from 'crypto';
import { Asistencia } from '../entities/asistencia.entity';
import { AsistenciaHistorial } from '../entities/asistencia-historial.entity';
import { CicloEscolar, Docente, GrupoMateria, Inscripcion } from '../entities';
import { JwtUser } from '../common/current-user.decorator';
import { exigirGrupoVigente } from '../common/contexto-academico';
import { ScopeService } from '../planteles/scope.service';
import { CapturaAsistenciaDto, ConsultaAsistenciaDto } from './asistencias.dto';
const hoy = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
export function revisionAsistencias(filas: Pick<Asistencia, 'id' | 'estado' | 'updatedAt'>[]) {
  return createHash('sha256')
    .update(JSON.stringify(filas.map((f) => [f.id, f.estado, f.updatedAt]).sort((a, b) => Number(a[0]) - Number(b[0]))))
    .digest('hex');
}
@Injectable()
export class AsistenciasService {
  constructor(
    private readonly ds: DataSource,
    private readonly scope: ScopeService,
  ) {}
  private async docente(user: JwtUser) {
    if (!user.roles.includes('MAESTRO'))
      throw new ForbiddenException('Solo un profesor asignado puede capturar asistencias');
    const docente = await this.ds.getRepository(Docente).findOneBy({ usuarioId: user.sub, estatus: 'ACTIVO' });
    if (!docente) throw new ForbiddenException('No tienes expediente docente activo');
    return docente;
  }
  private async clase(id: number, user: JwtUser, captura = false) {
    const clase = await this.ds.getRepository(GrupoMateria).findOneBy({ id });
    if (!clase) throw new NotFoundException('Clase no encontrada');
    if (captura) {
      const docente = await this.docente(user);
      if (clase.docenteId !== docente.id) throw new ForbiddenException('Solo el profesor asignado puede capturar');
    } else if (!user.roles.includes('SUPERADMIN')) {
      if (user.roles.includes('ADMINISTRATIVO')) await this.scope.validarGestion(user, clase.grupo.plantelId);
      else if (clase.docenteId !== (await this.docente(user)).id)
        throw new ForbiddenException('Clase fuera de alcance');
    }
    return clase;
  }
  async clases(user: JwtUser) {
    if (user.roles.includes('ALUMNO')) return [];
    const qb = this.ds
      .getRepository(GrupoMateria)
      .createQueryBuilder('gm')
      .innerJoinAndSelect('gm.grupo', 'g')
      .innerJoinAndSelect('gm.materia', 'm')
      .innerJoinAndSelect('g.ciclo', 'c');
    if (!user.roles.includes('SUPERADMIN')) {
      if (user.roles.includes('ADMINISTRATIVO'))
        qb.andWhere('g.plantel_id IN (:...planteles)', { planteles: await this.scope.resolverFiltro(user) });
      else qb.andWhere('gm.docente_id = :docente', { docente: (await this.docente(user)).id });
    }
    return (await qb.orderBy('gm.id', 'DESC').take(500).getMany()).map((c) => ({
      id: c.id,
      nombre: c.grupo.nombre + ' · ' + c.materia.nombre + ' · ' + c.grupo.ciclo.nombre,
      cicloInicio: c.grupo.ciclo.fechaInicio,
      cicloFin: c.grupo.ciclo.fechaFin,
    }));
  }
  async lista(id: number, fecha: string, user: JwtUser) {
    const clase = await this.clase(id, user);
    const alumnos = await this.ds
      .getRepository(Inscripcion)
      .find({
        where: { grupoId: clase.grupoId, estatus: 'ACTIVA', alumno: { estatus: 'ACTIVO', usuario: { activo: true } } },
      });
    const registros = await this.ds.getRepository(Asistencia).findBy({ grupoMateriaId: id, fecha });
    const docente = user.roles.includes('MAESTRO')
      ? await this.ds.getRepository(Docente).findOneBy({ usuarioId: user.sub, estatus: 'ACTIVO' })
      : null;
    return {
      revision: revisionAsistencias(registros),
      puedeCapturar: docente?.id === clase.docenteId && !!docente,
      alumnos: alumnos.map((i) => ({
        id: i.alumnoId,
        matricula: i.alumno.matricula,
        nombre: i.alumno.usuario.nombreCompleto,
        estado: registros.find((r) => r.alumnoId === i.alumnoId)?.estado ?? '',
      })),
    };
  }
  async capturar(dto: CapturaAsistenciaDto, user: JwtUser) {
    const clase = await this.clase(dto.grupoMateriaId, user, true);
    if (!dto.motivo.trim()) throw new BadRequestException('Indica el motivo de captura o corrección');
    if (new Set(dto.registros.map((r) => r.alumnoId)).size !== dto.registros.length)
      throw new BadRequestException('Hay alumnos duplicados');
    if (dto.fecha > hoy() || dto.fecha < clase.grupo.ciclo.fechaInicio || dto.fecha > clase.grupo.ciclo.fechaFin)
      throw new BadRequestException('La fecha debe pertenecer al ciclo y no puede ser futura');
    return this.ds.transaction(async (manager) => {
      const ciclo = await manager
        .getRepository(CicloEscolar)
        .findOne({ where: { id: clase.grupo.cicloId }, lock: { mode: 'pessimistic_write' } });
      if (!ciclo || !ciclo.activo || ciclo.estado !== 'ACTIVO') throw new ConflictException('El ciclo no está activo');
      const actual = await manager
        .getRepository(GrupoMateria)
        .findOne({ where: { id: clase.id }, lock: { mode: 'pessimistic_write' } });
      if (!actual || (actual.docenteId !== clase.docenteId || actual.grupoId !== clase.grupoId))
        throw new ConflictException('Cambió el profesor; recarga la clase');
      exigirGrupoVigente(actual.grupo);
      const repo = manager.getRepository(Asistencia),
        filas = await repo.findBy({ grupoMateriaId: clase.id, fecha: dto.fecha });
      if (revisionAsistencias(filas) !== dto.revision)
        throw new ConflictException('La lista cambió; recarga antes de guardar');
      const inscritos = await manager
        .getRepository(Inscripcion)
        .find({
          where: {
            grupoId: clase.grupoId,
            alumnoId: In(dto.registros.map((r) => r.alumnoId)),
            estatus: 'ACTIVA',
            alumno: { estatus: 'ACTIVO', usuario: { activo: true } },
          },
        });
      if (inscritos.length !== dto.registros.length)
        throw new ForbiddenException('Hay alumnos sin inscripción activa en esta clase');
      for (const registro of dto.registros) {
        const previo = filas.find((f) => f.alumnoId === registro.alumnoId);
        if (previo?.estado === registro.estado) continue;
        const anterior = previo?.estado ?? null;
        const guardado = await repo.save(
          repo.create({
            ...previo,
            grupoMateriaId: clase.id,
            alumnoId: registro.alumnoId,
            plantelId: clase.grupo.plantelId,
            fecha: dto.fecha,
            estado: registro.estado,
            capturadoPorId: user.sub,
          }),
        );
        await manager
          .getRepository(AsistenciaHistorial)
          .save({
            asistenciaId: guardado.id,
            usuarioId: user.sub,
            anterior,
            nuevo: registro.estado,
            motivo: dto.motivo.trim(),
          });
      }
      return { ok: true };
    });
  }
  async consultar(q: ConsultaAsistenciaDto, user: JwtUser) {
    const desde = q.desde ?? hoy().slice(0, 7) + '-01',
      hasta = q.hasta ?? hoy();
    if (hasta < desde || Date.parse(hasta) - Date.parse(desde) > 366 * 86400000)
      throw new BadRequestException('Consulta un intervalo de hasta 366 días');
    const qb = this.ds
      .getRepository(Asistencia)
      .createQueryBuilder('a')
      .innerJoin('a.alumno', 'al')
      .innerJoin('al.usuario', 'u')
      .innerJoin('a.grupoMateria', 'gm')
      .innerJoin('gm.grupo', 'g')
      .innerJoin('gm.materia', 'm')
      .select([
        'a.id AS id',
        'a.fecha AS fecha',
        'a.estado AS estado',
        'a.alumnoId AS alumnoId',
        'al.matricula AS matricula',
        'u.nombre AS nombre',
        'u.apellidoPaterno AS apellido',
        'g.nombre AS grupo',
        'm.nombre AS materia',
      ])
      .where('a.fecha BETWEEN :desde AND :hasta', { desde, hasta });
    if (user.roles.includes('ALUMNO')) {
      qb.andWhere('al.usuario_id = :sub', { sub: user.sub });
    } else if (!user.roles.includes('SUPERADMIN')) {
      if (user.roles.includes('ADMINISTRATIVO'))
        qb.andWhere('a.plantel_id IN (:...planteles)', { planteles: await this.scope.resolverFiltro(user) });
      else qb.andWhere('gm.docente_id = :docente', { docente: (await this.docente(user)).id });
    }
    if (q.grupoMateriaId) qb.andWhere('a.grupo_materia_id = :clase', { clase: q.grupoMateriaId });
    if (q.alumnoId) qb.andWhere('a.alumno_id = :alumno', { alumno: q.alumnoId });
    return {
      datos: await qb
        .orderBy('a.fecha', 'DESC')
        .addOrderBy('a.id', 'DESC')
        .offset(((q.pagina ?? 1) - 1) * 100)
        .limit(100)
        .getRawMany(),
      pagina: q.pagina ?? 1,
      porPagina: 100,
    };
  }
  async historial(id: number, user: JwtUser) {
    const registro = await this.ds.getRepository(Asistencia).findOneBy({ id });
    if (!registro) throw new NotFoundException();
    if (user.roles.includes('ALUMNO')) throw new ForbiddenException('El historial de cambios es interno');
    if (user.roles.includes('ADMINISTRATIVO') && !user.roles.includes('SUPERADMIN'))
      await this.scope.validarGestion(user, registro.plantelId);
    else await this.clase(registro.grupoMateriaId, user);
    return this.ds
      .getRepository(AsistenciaHistorial)
      .find({ where: { asistenciaId: id }, order: { id: 'DESC' }, take: 100 });
  }
}
