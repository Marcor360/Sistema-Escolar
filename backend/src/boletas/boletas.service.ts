import { versionAcademicaBoleta } from './version-boleta';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { DataSource } from 'typeorm';
import { Calificacion, CicloEscolar, GrupoMateria, Inscripcion, PeriodoCalificacion } from '../entities';
import { BoletaRespuesta } from '../entities/boleta-respuesta.entity';
import { JwtUser } from '../common/current-user.decorator';
import { ScopeService } from '../planteles/scope.service';
import { boletaPublicable } from '../reportes/publicacion-boleta';
import { ComentarioBoletaDto, ListarBoletasDto, ResponderBoletaDto } from './boletas.dto';
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
@Injectable()
export class BoletasService {
  constructor(
    private readonly ds: DataSource,
    private readonly scope: ScopeService,
  ) {}
  private async contexto(id: number, u: JwtUser, m = this.ds.manager) {
    const i = await m.getRepository(Inscripcion).findOneBy({ id });
    if (!i) throw new NotFoundException('Inscripción no encontrada');
    if (u.roles.includes('ALUMNO')) {
      if (i.alumno.usuarioId !== u.sub) throw new ForbiddenException('Solo puedes consultar tu boleta');
    } else if (u.roles.some((r) => ['SUPERADMIN', 'ADMINISTRATIVO', 'DIRECTOR'].includes(r)))
      await this.scope.validarGestion(u, i.grupo.plantelId);
    else if (u.roles.includes('MAESTRO')) {
      if (!(await m.getRepository(GrupoMateria).existsBy({ grupoId: i.grupoId, docente: { usuarioId: u.sub, estatus: 'ACTIVO' } })))
        throw new ForbiddenException('La boleta no pertenece a una clase asignada');
    } else throw new ForbiddenException('No tienes acceso al seguimiento de boletas');
    return i;
  }
  private async version(i: Inscripcion, m = this.ds.manager) {
    const [clases, notas, periodos] = await Promise.all([
      m.getRepository(GrupoMateria).find({ where: { grupoId: i.grupoId }, order: { id: 'ASC' } }),
      m.getRepository(Calificacion).find({ where: { alumnoId: i.alumnoId, grupoMateria: { grupoId: i.grupoId } } }),
      m.getRepository(PeriodoCalificacion).find({ where: { grupoMateria: { grupoId: i.grupoId } } }),
    ]);
    const v = versionAcademicaBoleta(i.id, clases, notas);
    return { ...v, disponible: boletaPublicable(clases, notas, periodos), clases };
  }
  async detalle(id: number, u: JwtUser) {
    const i = await this.contexto(id, u),
      v = await this.version(i);
    const docente = !u.roles.some((r) => ['ALUMNO', 'SUPERADMIN', 'ADMINISTRATIVO', 'DIRECTOR'].includes(r));
    const propias = v.clases.filter((c) => c.docente?.usuarioId === u.sub).map((c) => c.id);
    const eventos = await this.ds.getRepository(BoletaRespuesta).find({
      where: { inscripcionId: id },
      relations: { grupoMateria: { materia: true } },
      order: { id: 'DESC' },
      take: 100,
    });
    return {
      inscripcionId: id,
      alumnoId: i.alumnoId,
      alumno: i.alumno.usuario.nombreCompleto,
      matricula: i.alumno.matricula,
      disponible: v.disponible,
      versionHash: v.hash,
      estado: !v.disponible
        ? 'PENDIENTE_PUBLICACION'
        : (eventos.find((e) => e.versionHash === v.hash && e.estado !== 'COMENTARIO')?.estado ?? 'PENDIENTE_RESPUESTA'),
      materiasDocente: v.filas.filter((f) => propias.includes(f.grupoMateriaId)),
      materias: docente ? v.filas.filter((f) => propias.includes(f.grupoMateriaId)) : v.disponible ? v.filas : [],
      historial: eventos
        .filter((e) => e.estado !== 'COMENTARIO' || !docente || propias.includes(e.grupoMateriaId!))
        .map((e) => ({
          id: e.id,
          estado: e.estado,
          comentario: e.comentario,
          firmanteNombre: e.firmanteNombre,
          firmanteTipo: e.firmanteTipo,
          asignatura: e.grupoMateria?.materia.nombre ?? null,
          fecha: e.createdAt,
          vigente: e.versionHash === v.hash && v.disponible,
        })),
    };
  }
  async responder(id: number, d: ResponderBoletaDto, u: JwtUser) {
    if (!u.roles.includes('ALUMNO'))
      throw new ForbiddenException('La respuesta se registra desde la cuenta del alumno');
    if (d.estado === 'REVISION' && !d.comentario?.trim())
      throw new BadRequestException('Escribe los comentarios para solicitar revisión');
    return this.ds.transaction('READ COMMITTED', async (m) => {
      const i = await this.contexto(id, u, m);
      await m
        .getRepository(CicloEscolar)
        .findOneOrFail({ where: { id: i.grupo.cicloId }, lock: { mode: 'pessimistic_write' } });
      const v = await this.version(i, m),
        repo = m.getRepository(BoletaRespuesta),
        peticionHash = hash({ id, actor: u.sub, ...d });
      const anterior = await repo.findOneBy({ idempotencia: d.idempotencia });
      if (anterior) {
        if (anterior.peticionHash !== peticionHash)
          throw new ConflictException('La clave ya corresponde a otra respuesta');
        return { id: anterior.id, estado: anterior.estado };
      }
      if (!v.disponible) throw new ConflictException('La boleta todavía no está publicada');
      if (v.hash !== d.versionHash)
        throw new ConflictException('Las calificaciones cambiaron. Actualiza y revisa la nueva boleta antes de firmar');
      const r = await repo.save(
        repo.create({
          inscripcionId: id,
          actorId: u.sub,
          grupoMateriaId: null,
          idempotencia: d.idempotencia,
          peticionHash,
          versionHash: v.hash,
          estado: d.estado,
          firmanteNombre: d.firmanteNombre,
          firmanteTipo: d.firmanteTipo,
          comentario: d.comentario ?? '',
          snapshotJson: JSON.stringify(v.filas),
        }),
      );
      return { id: r.id, estado: r.estado };
    });
  }
  async comentar(id: number, d: ComentarioBoletaDto, u: JwtUser) {
    const i = await this.contexto(id, u);
    const gm = await this.ds
      .getRepository(GrupoMateria)
      .findOneBy({ id: d.grupoMateriaId, grupoId: i.grupoId, docente: { usuarioId: u.sub, estatus: 'ACTIVO' } });
    if (!u.roles.includes('MAESTRO') || !gm)
      throw new ForbiddenException('Solo el docente asignado comenta su materia');
    return this.ds.transaction(async (m) => {
      await m
        .getRepository(CicloEscolar)
        .findOneOrFail({ where: { id: i.grupo.cicloId }, lock: { mode: 'pessimistic_write' } });
      // La clase serializa reintentos del mismo docente sin modificar ninguna calificación.
      await m
        .getRepository(GrupoMateria)
        .findOneOrFail({ where: { id: gm.id }, loadEagerRelations: false, lock: { mode: 'pessimistic_write' } });
      if (!(await m.getRepository(GrupoMateria).existsBy({ id: gm.id, docente: { usuarioId: u.sub, estatus: 'ACTIVO' } })))
        throw new ForbiddenException('La asignación docente cambió');
      const repo = m.getRepository(BoletaRespuesta),
        peticionHash = hash({ id, actor: u.sub, ...d }),
        previa = await repo.findOneBy({ idempotencia: d.idempotencia });
      if (previa) {
        if (previa.peticionHash !== peticionHash) throw new ConflictException('La clave corresponde a otro comentario');
        return { id: previa.id };
      }
      const v = await this.version(i, m);
      if (!v.disponible || v.hash !== d.versionHash)
        throw new ConflictException('Actualiza la boleta antes de comentar');
      const r = await repo.save(
        repo.create({
          inscripcionId: id,
          actorId: u.sub,
          grupoMateriaId: gm.id,
          idempotencia: d.idempotencia,
          peticionHash,
          versionHash: v.hash,
          estado: 'COMENTARIO',
          firmanteNombre: u.nombre.slice(0,150),
          firmanteTipo: 'DOCENTE',
          comentario: d.comentario,
          snapshotJson: null,
        }),
      );
      return { id: r.id };
    });
  }
  async listar(q: ListarBoletasDto, u: JwtUser) {
    if (!u.roles.some((r) => ['SUPERADMIN', 'ADMINISTRATIVO', 'DIRECTOR', 'MAESTRO'].includes(r)))
      throw new ForbiddenException('Consulta exclusiva de personal académico');
    const qb = this.ds
      .getRepository(BoletaRespuesta)
      .createQueryBuilder('r')
      .innerJoinAndSelect('r.inscripcion', 'i')
      .innerJoinAndSelect('i.alumno', 'a')
      .innerJoinAndSelect('a.usuario', 'u')
      .innerJoinAndSelect('i.grupo', 'g')
      .where(
        "r.estado IN ('ACEPTADA','REVISION') AND NOT EXISTS (SELECT 1 FROM boleta_respuestas b WHERE b.inscripcion_id=r.inscripcion_id AND b.estado IN ('ACEPTADA','REVISION') AND b.id>r.id)",
      );
    const administrativo = u.roles.some((r) => ['SUPERADMIN', 'ADMINISTRATIVO', 'DIRECTOR'].includes(r));
    if (administrativo) {
      const ids = await this.scope.resolverFiltro(u, q.plantelId);
      if (ids !== null) qb.andWhere('g.plantel_id IN (:...ids)', { ids });
    } else {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM grupo_materias gm INNER JOIN docentes d ON d.id=gm.docente_id WHERE gm.grupo_id=i.grupo_id AND d.usuario_id=:actor)',
        { actor: u.sub },
      );
      if (q.plantelId) qb.andWhere('g.plantel_id=:plantel', { plantel: q.plantelId });
    }
    if (q.estado) qb.andWhere('r.estado=:estado', { estado: q.estado });
    const [rows, total] = await qb
      .orderBy('r.id', 'DESC')
      .skip((q.pagina - 1) * q.porPagina)
      .take(q.porPagina)
      .getManyAndCount();
    const datos = await Promise.all(
      rows.map(async (r) => {
        const v = await this.version(r.inscripcion);
        return {
          id: r.id,
          inscripcionId: r.inscripcionId,
          alumno: r.inscripcion.alumno.usuario.nombreCompleto,
          matricula: r.inscripcion.alumno.matricula,
          estado: r.estado,
          fecha: r.createdAt,
          vigente: v.disponible && v.hash === r.versionHash,
        };
      }),
    );
    return { datos, total, pagina: q.pagina, porPagina: q.porPagina };
  }
}
