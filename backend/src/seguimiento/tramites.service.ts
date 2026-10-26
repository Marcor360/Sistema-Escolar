import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Alumno, Usuario, UsuarioPlantel } from '../entities';
import { Tramite } from '../entities/tramite.entity';
import { TramiteHistorial } from '../entities/tramite-historial.entity';
import { ScopeService } from '../planteles/scope.service';
import { JwtUser } from '../common/current-user.decorator';
import { CambiarTramiteDto, NuevoTramiteDto } from './seguimiento.dto';
@Injectable()
export class TramitesService {
  constructor(
    private readonly ds: DataSource,
    private readonly scope: ScopeService,
  ) {}
  private async autorizar(t: Tramite, u: JwtUser) {
    if (u.roles.includes('ALUMNO')) {
      if (!(await this.ds.getRepository(Alumno).findOneBy({ id: t.alumnoId, usuarioId: u.sub })))
        throw new ForbiddenException();
    } else if (u.roles.some((r) => ['SUPERADMIN', 'ADMINISTRATIVO'].includes(r)))
      await this.scope.validarGestion(u, t.plantelId);
    else throw new ForbiddenException();
  }
  async listar(u: JwtUser) {
    const qb = this.ds.getRepository(Tramite).createQueryBuilder('t');
    if (u.roles.includes('ALUMNO')) qb.innerJoin('t.alumno', 'a').andWhere('a.usuario_id=:sub', { sub: u.sub });
    else if (!u.roles.includes('SUPERADMIN'))
      qb.andWhere('t.plantel_id IN (:...planteles)', { planteles: await this.scope.resolverFiltro(u) });
    return qb.orderBy('t.id', 'DESC').take(100).getMany();
  }
  async crear(d: NuevoTramiteDto, u: JwtUser) {
    if (!u.roles.includes('ALUMNO')) throw new ForbiddenException('La solicitud la inicia el alumno');
    const alumno = await this.ds.getRepository(Alumno).findOneBy({ usuarioId: u.sub, estatus: 'ACTIVO' });
    if (!alumno) throw new ForbiddenException();
    const repo = this.ds.getRepository(Tramite);
    const anterior = await repo.findOneBy({ clave: d.clave });
    if (anterior) {
      await this.autorizar(anterior, u);
      if (anterior.tipo !== d.tipo || anterior.detalle !== d.detalle)
        throw new ConflictException('La clave ya identifica otra solicitud');
      return anterior;
    }
    return this.ds.transaction(async (m) => {
      const t = await m
        .getRepository(Tramite)
        .save({
          alumnoId: alumno.id,
          plantelId: alumno.plantelId,
          clave: d.clave,
          tipo: d.tipo,
          detalle: d.detalle,
          estado: 'SOLICITADO',
          revision: 1,
        });
      await m
        .getRepository(TramiteHistorial)
        .save({ tramiteId: t.id, usuarioId: u.sub, estado: t.estado, mensaje: 'Solicitud registrada' });
      return t;
    });
  }
  async historial(id: number, u: JwtUser) {
    const t = await this.ds.getRepository(Tramite).findOneBy({ id });
    if (!t) throw new NotFoundException();
    await this.autorizar(t, u);
    return this.ds.getRepository(TramiteHistorial).find({ where: { tramiteId: id }, order: { id: 'ASC' } });
  }
  async cambiar(id: number, d: CambiarTramiteDto, u: JwtUser) {
    return this.ds.transaction(async (m) => {
      const repo = m.getRepository(Tramite),
        t = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!t) throw new NotFoundException();
      await this.autorizar(t, u);
      if (t.revision !== d.revision) throw new ConflictException('El trámite cambió; recarga');
      if (['RESUELTO', 'RECHAZADO', 'CANCELADO'].includes(t.estado))
        throw new ConflictException('El trámite ya está cerrado');
      if (u.roles.includes('ALUMNO') && (d.estado !== 'CANCELADO' || t.estado !== 'SOLICITADO' || d.responsableId))
        throw new ForbiddenException('Solo puedes cancelar una solicitud sin atender');
      if (d.estado === 'EN_REVISION' && !d.responsableId) throw new BadRequestException('Asigna un responsable');
      if (d.responsableId) {
        const responsable = await m.getRepository(Usuario).findOneBy({ id: d.responsableId, activo: true });
        if (!responsable || !responsable.roles.some((r) => ['ADMINISTRATIVO', 'SUPERADMIN'].includes(r.clave)))
          throw new BadRequestException('El responsable debe ser personal administrativo');
        if (
          !responsable.roles.some((r) => r.clave === 'SUPERADMIN') &&
          !(await m
            .getRepository(UsuarioPlantel)
            .findOneBy({ usuarioId: responsable.id, plantelId: t.plantelId, activo: true }))
        )
          throw new BadRequestException('El responsable no tiene acceso al plantel');
        t.responsableId = responsable.id;
      }
      t.estado = d.estado;
      t.revision++;
      await repo.save(t);
      await m
        .getRepository(TramiteHistorial)
        .save({ tramiteId: id, usuarioId: u.sub, estado: d.estado, mensaje: d.mensaje });
      return t;
    });
  }
}
