import { constanciaBoleta } from './constancia-boleta';
import { BoletasBandejaService } from './boletas-bandeja.service';
import { versionesBoletas } from './lectura-boletas';
import { BoletaAtencion } from '../entities/boleta-atencion.entity';
import { Notificacion } from '../entities/notificacion.entity';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { DataSource } from 'typeorm';
import { CicloEscolar, GrupoMateria, Inscripcion, Usuario } from '../entities';
import { BoletaRespuesta } from '../entities/boleta-respuesta.entity';
import { JwtUser } from '../common/current-user.decorator';
import { ScopeService } from '../planteles/scope.service';
import {
  ComentarioBoletaDto,
  ListarBoletasDto,
  ResponderBoletaDto,
  AtenderBoletaDto,
  FiltrosBoletaDto,
} from './boletas.dto';
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
@Injectable()
export class BoletasService {
  constructor(
    private readonly ds: DataSource,
    private readonly scope: ScopeService,
    private readonly bandeja: BoletasBandejaService,
  ) {}
  private async contexto(id: number, u: JwtUser, m = this.ds.manager) {
    const i = await m.getRepository(Inscripcion).findOneBy({ id });
    if (!i) throw new NotFoundException('Inscripción no encontrada');
    if (u.roles.includes('ALUMNO')) {
      if (i.alumno.usuarioId !== u.sub) throw new ForbiddenException('Solo puedes consultar tu boleta');
    } else if (u.roles.some((r) => ['SUPERADMIN', 'ADMINISTRATIVO', 'DIRECTOR'].includes(r)))
      await this.scope.validarGestion(u, i.grupo.plantelId);
    else if (u.roles.includes('MAESTRO')) {
      if (
        !(await m
          .getRepository(GrupoMateria)
          .existsBy({ grupoId: i.grupoId, docente: { usuarioId: u.sub, estatus: 'ACTIVO' } }))
      )
        throw new ForbiddenException('La boleta no pertenece a una clase asignada');
    } else throw new ForbiddenException('No tienes acceso al seguimiento de boletas');
    return i;
  }
  private async version(i: Inscripcion, m = this.ds.manager) {
    return (await versionesBoletas(m, [i])).get(i.id)!;
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
    const ultima = await this.ds
      .getRepository(BoletaRespuesta)
      .createQueryBuilder('r')
      .where("r.inscripcion_id=:id AND r.estado IN ('ACEPTADA','REVISION')", { id })
      .orderBy('r.id', 'DESC')
      .getOne();
    const todasAtenciones = await this.ds.getRepository(BoletaAtencion).find({
      where: { respuesta: { inscripcionId: id } },
      relations: { actor: true, responsable: true },
      order: { id: 'DESC' },
      take: 100,
    });
    const atenciones = todasAtenciones.filter((t) => t.respuestaId === ultima?.id);
    const gestionar = u.roles.some((r) => ['SUPERADMIN', 'ADMINISTRATIVO', 'DIRECTOR'].includes(r));
    return {
      historialAtenciones: todasAtenciones.map((t) => ({
        id: t.id,
        respuestaId: t.respuestaId,
        estado: t.estado,
        responsable: t.responsable.nombreCompleto,
        actor: t.actor.nombreCompleto,
        comentario: t.comentario,
        fecha: t.createdAt,
      })),
      revisionId: ultima?.estado === 'REVISION' && ultima.versionHash === v.hash && v.disponible ? ultima.id : null,
      puedeGestionar: gestionar,
      responsables: gestionar ? await this.responsables(i) : [],
      atencion:
        ultima?.estado === 'REVISION'
          ? {
              estado: atenciones[0]?.estado ?? 'PENDIENTE',
              vigente: ultima.versionHash === v.hash && v.disponible,
              eventos: atenciones.map((t) => ({
                id: t.id,
                estado: t.estado,
                responsableId: t.responsableId,
                responsable: t.responsable.nombreCompleto,
                actor: t.actor.nombreCompleto,
                comentario: t.comentario,
                fecha: t.createdAt,
              })),
            }
          : null,
      inscripcionId: id,
      alumnoId: i.alumnoId,
      alumno: i.alumno.usuario.nombreCompleto,
      matricula: i.alumno.matricula,
      disponible: v.disponible,
      versionHash: v.hash,
      estado: !v.disponible
        ? 'PENDIENTE_PUBLICACION'
        : ultima?.versionHash === v.hash
          ? ultima.estado
          : 'PENDIENTE_RESPUESTA',
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
      if (
        !(await m.getRepository(GrupoMateria).existsBy({ id: gm.id, docente: { usuarioId: u.sub, estatus: 'ACTIVO' } }))
      )
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
          firmanteNombre: u.nombre.slice(0, 150),
          firmanteTipo: 'DOCENTE',
          comentario: d.comentario,
          snapshotJson: null,
        }),
      );
      await this.avisar(
        m,
        i.alumno.usuarioId,
        'Nuevo comentario en tu boleta',
        'Un profesor respondió en una materia. Consulta Calificaciones para revisar el comentario.',
      );
      return { id: r.id };
    });
  }
  async constancia(id: number, respuestaId: number, u: JwtUser) {
    if (!u.roles.some((r) => ['ALUMNO', 'SUPERADMIN', 'ADMINISTRATIVO', 'DIRECTOR'].includes(r)))
      throw new ForbiddenException('La constancia es privada para la familia y administración');
    const i = await this.contexto(id, u),
      r = await this.ds
        .getRepository(BoletaRespuesta)
        .findOneBy({ id: respuestaId, inscripcionId: id, estado: 'ACEPTADA' });
    if (!r || !r.snapshotJson) throw new NotFoundException('Constancia de aceptación no encontrada');
    const v = await this.version(i);
    return constanciaBoleta(
      r,
      i.alumno.usuario.nombreCompleto,
      i.alumno.matricula,
      v.disponible && v.hash === r.versionHash,
    );
  }
  filtros(q: FiltrosBoletaDto, u: JwtUser) {
    return this.bandeja.filtros(q, u);
  }
  listar(q: ListarBoletasDto, u: JwtUser) {
    return this.bandeja.listar(q, u);
  }
  misPendientes(u: JwtUser) {
    return this.bandeja.listar(Object.assign(new ListarBoletasDto(), { estado: 'PENDIENTE_RESPUESTA' }), u, true);
  }
  private async avisar(m: import('typeorm').EntityManager, usuarioId: number, titulo: string, mensaje: string) {
    // Aviso interno confirmado con la misma transacción; no dispara correo ni push.
    await m
      .getRepository(Notificacion)
      .save({ usuarioId, titulo, mensaje, tipo: 'ACADEMICA', leida: false, pushPendiente: false });
  }
  private async responsables(i: Inscripcion, m = this.ds.manager) {
    const rows = await m
      .getRepository(Usuario)
      .createQueryBuilder('u')
      .innerJoin('u.roles', 'rol')
      .where('u.activo=:activo', { activo: true })
      .andWhere(
        '(rol.clave=\'SUPERADMIN\' OR (rol.clave IN (\'ADMINISTRATIVO\',\'DIRECTOR\') AND EXISTS (SELECT 1 FROM usuario_planteles up WHERE up.usuario_id=u.id AND up.plantel_id=:plantel AND up.activo=:activo)) OR (rol.clave=\'MAESTRO\' AND EXISTS (SELECT 1 FROM docentes d INNER JOIN grupo_materias gm ON gm.docente_id=d.id WHERE d.usuario_id=u.id AND d.estatus=\'ACTIVO\' AND gm.grupo_id=:grupo)))',
        { plantel: i.grupo.plantelId, grupo: i.grupoId },
      )
      .distinct(true)
      .orderBy('u.nombre', 'ASC')
      .getMany();
    return rows.map((u) => ({ id: u.id, nombre: u.nombreCompleto }));
  }
  async atender(id: number, d: AtenderBoletaDto, u: JwtUser) {
    if (!u.roles.some((r) => ['SUPERADMIN', 'ADMINISTRATIVO', 'DIRECTOR'].includes(r)))
      throw new ForbiddenException('Solo Administración o Dirección gestiona la revisión');
    return this.ds.transaction('READ COMMITTED', async (m) => {
      const i = await this.contexto(id, u, m);
      await m
        .getRepository(CicloEscolar)
        .findOneOrFail({ where: { id: i.grupo.cicloId }, lock: { mode: 'pessimistic_write' } });
      const repo = m.getRepository(BoletaAtencion),
        peticionHash = hash({ id, actor: u.sub, ...d });
      const previa = await repo.findOneBy({ idempotencia: d.idempotencia });
      if (previa) {
        if (previa.peticionHash !== peticionHash)
          throw new ConflictException('La clave ya corresponde a otra atención');
        return { id: previa.id, estado: previa.estado };
      }
      const r = await m
        .getRepository(BoletaRespuesta)
        .createQueryBuilder('r')
        .where("r.inscripcion_id=:id AND r.estado IN ('ACEPTADA','REVISION')", { id })
        .orderBy('r.id', 'DESC')
        .getOne();
      const v = await this.version(i, m);
      if (
        !r ||
        r.id !== d.respuestaId ||
        r.estado !== 'REVISION' ||
        !v.disponible ||
        r.versionHash !== v.hash ||
        d.versionHash !== v.hash
      )
        throw new ConflictException('La revisión cambió. Actualiza la boleta antes de atenderla');
      if (!(await this.responsables(i, m)).some((p) => p.id === d.responsableId))
        throw new ForbiddenException('El responsable debe estar activo y tener alcance en este plantel o grupo');
      const anterior = await repo.findOne({ where: { respuestaId: r.id }, order: { id: 'DESC' } });
      const estado = anterior?.estado ?? 'PENDIENTE';
      if (d.estado === 'RESUELTA' && estado !== 'EN_ATENCION')
        throw new ConflictException('Primero registra la revisión en atención');
      if (estado === 'RESUELTA' && d.estado !== 'EN_ATENCION')
        throw new ConflictException('Para reabrir la revisión selecciona En atención');
      const evento = await repo.save(
        repo.create({
          respuestaId: r.id,
          actorId: u.sub,
          responsableId: d.responsableId,
          idempotencia: d.idempotencia,
          peticionHash,
          estado: d.estado,
          comentario: d.comentario,
        }),
      );
      await this.avisar(
        m,
        i.alumno.usuarioId,
        d.estado === 'RESUELTA' ? 'Revisión de boleta resuelta' : 'Actualización de tu revisión de boleta',
        'Consulta Calificaciones para ver el estado y la respuesta del personal escolar.',
      );
      return { id: evento.id, estado: evento.estado };
    });
  }
}
