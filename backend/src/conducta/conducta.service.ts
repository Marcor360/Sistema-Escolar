import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Incidencia } from '../entities/incidencia.entity';
import { IncidenciaSeguimiento } from '../entities/incidencia-seguimiento.entity';
import { Inscripcion } from '../entities/inscripcion.entity';
import { Grupo } from '../entities/grupo.entity';
import { GrupoMateria } from '../entities/grupo-materia.entity';
import { BitacoraAcademica } from '../entities/bitacora-academica.entity';
import { ScopeService } from '../planteles/scope.service';
import { JwtUser } from '../common/current-user.decorator';
import { inscripcionVigente } from '../common/contexto-academico';
import { CrearIncidenciaDto, ListarIncidenciasDto, SeguimientoIncidenciaDto } from './conducta.dto';

@Injectable()
export class ConductaService {
  constructor(private readonly ds: DataSource, private readonly scope: ScopeService) {}
  private maestro(user: JwtUser) { return !user.roles.some((r) => ['SUPERADMIN', 'ADMINISTRATIVO'].includes(r)); }
  private async gruposDocente(user: JwtUser) {
    return this.ds.getRepository(GrupoMateria).find({ where: { docente: { usuarioId: user.sub, estatus: 'ACTIVO' }, grupo: { activo: true, ciclo: { activo: true }, plantel: { activo: true } } } });
  }
  private async autorizar(grupoId: number, user: JwtUser) {
    const grupo = await this.ds.getRepository(Grupo).findOneBy({ id: grupoId });
    if (!grupo) throw new NotFoundException('Grupo no encontrado');
    if (this.maestro(user)) {
      if (!(await this.gruposDocente(user)).some((c) => c.grupoId === grupoId)) throw new ForbiddenException('La incidencia queda fuera de tus grupos vigentes');
    } else await this.scope.validarGestion(user, grupo.plantelId);
    return grupo;
  }
  async listar(query: ListarIncidenciasDto, user: JwtUser) {
    const permitidos = await this.scope.resolverFiltro(user, query.plantelId);
    const qb = this.ds.getRepository(Incidencia).createQueryBuilder('i').innerJoin(Grupo, 'g', 'g.id = i.grupo_id');
    if (query.cicloId) qb.andWhere('g.ciclo_id = :ciclo', { ciclo: query.cicloId });
    else qb.innerJoin('ciclos_escolares', 'c', 'c.id = g.ciclo_id AND c.activo = :activo', { activo: true });
    if (query.alumnoId) qb.andWhere('i.alumno_id = :alumno', { alumno: query.alumnoId });
    if (this.maestro(user)) {
      const ids = [...new Set((await this.gruposDocente(user)).map((c) => c.grupoId))];
      if (!ids.length) return { datos: [], total: 0, pagina: query.pagina, porPagina: query.porPagina };
      qb.andWhere('i.grupo_id IN (:...grupos)', { grupos: ids });
    } else if (permitidos !== null) qb.andWhere('g.plantel_id IN (:...planteles)', { planteles: permitidos });
    const [datos, total] = await qb.orderBy('i.id', 'DESC').skip((query.pagina - 1) * query.porPagina).take(query.porPagina).getManyAndCount();
    return { datos, total, pagina: query.pagina, porPagina: query.porPagina };
  }
  async detalle(id: number, user: JwtUser) {
    const incidencia = await this.ds.getRepository(Incidencia).findOneBy({ id });
    if (!incidencia) throw new NotFoundException('Incidencia no encontrada');
    await this.autorizar(incidencia.grupoId, user);
    const seguimientos = await this.ds.getRepository(IncidenciaSeguimiento).find({ where: { incidenciaId: id }, order: { id: 'ASC' } });
    return { ...incidencia, seguimientos };
  }
  async crear(dto: CrearIncidenciaDto, user: JwtUser) {
    if (new Date(dto.fecha).getTime() > Date.now() + 5 * 60000) throw new BadRequestException('La incidencia no puede tener una fecha futura');
    const grupo = await this.autorizar(dto.grupoId, user);
    if (!await this.ds.getRepository(Inscripcion).findOne({ where: { ...inscripcionVigente, grupoId: dto.grupoId, alumnoId: dto.alumnoId } })) throw new ConflictException('El alumno no tiene inscripción vigente en ese grupo');
    return this.ds.transaction(async (manager) => {
      const repo = manager.getRepository(Incidencia);
      const incidencia = await repo.save(repo.create({ ...dto, fecha: new Date(dto.fecha), registradaPorId: user.sub, estado: 'ABIERTA' }));
      await manager.getRepository(BitacoraAcademica).insert({ usuarioId: user.sub, plantelId: grupo.plantelId, accion: 'INCIDENCIA_CREADA', entidadId: incidencia.id, detalle: `alumnoId=${dto.alumnoId}; grupoId=${dto.grupoId}`, fecha: new Date() });
      return incidencia;
    });
  }
  async seguir(id: number, dto: SeguimientoIncidenciaDto, user: JwtUser) {
    const previa = await this.detalle(id, user);
    const grupo = await this.autorizar(previa.grupoId, user);
    if (this.maestro(user) && ['CERRADA', 'ANULADA'].includes(dto.estado)) throw new ForbiddenException('El cierre o anulación corresponde a control escolar');
    return this.ds.transaction(async (manager) => {
      const repo = manager.getRepository(Incidencia);
      const incidencia = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!incidencia) throw new NotFoundException('Incidencia no encontrada');
      if (['CERRADA', 'ANULADA'].includes(incidencia.estado)) throw new ConflictException('Una incidencia cerrada conserva su historial; crea una nueva corrección relacionada');
      await manager.getRepository(IncidenciaSeguimiento).insert({ incidenciaId: id, usuarioId: user.sub, nota: dto.nota, motivo: dto.motivo, estado: dto.estado, fecha: new Date() });
      await repo.update(id, { estado: dto.estado });
      await manager.getRepository(BitacoraAcademica).insert({ usuarioId: user.sub, plantelId: grupo.plantelId, accion: 'INCIDENCIA_SEGUIMIENTO', entidadId: id, detalle: `estado=${dto.estado}`, fecha: new Date() });
      return { ok: true };
    });
  }
}
