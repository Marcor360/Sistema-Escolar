import { Type } from 'class-transformer';
import { IsInt, IsString, MaxLength, Min, IsOptional } from 'class-validator';
import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Grupo } from '../entities/grupo.entity';
import { GrupoMateria } from '../entities/grupo-materia.entity';
import { CicloEscolar } from '../entities/ciclo-escolar.entity';
import { ScopeService } from '../planteles/scope.service';
import { JwtUser } from '../common/current-user.decorator';
import { PaginacionDto } from '../common/paginacion.dto';
export class ConsultarFichaDto extends PaginacionDto {
  @IsOptional() @IsString() @MaxLength(80) buscar?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) plantelId?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) clasesPagina = 1;
}
@Injectable()
export class CicloFichaService {
  constructor(private readonly ds: DataSource, private readonly scope: ScopeService) {}
  async consultar(id: number, q: ConsultarFichaDto, user: JwtUser) {
    const ciclo = await this.ds.getRepository(CicloEscolar).findOneBy({ id });
    if (!ciclo) throw new NotFoundException('Ciclo no encontrado');
    const docente = !user.roles.some(r => ['SUPERADMIN', 'ADMINISTRATIVO', 'FINANZAS'].includes(r));
    const grupos = this.ds.getRepository(Grupo).createQueryBuilder('g').where('g.cicloId = :cicloId', { cicloId: id });
    if (docente) grupos.andWhere('EXISTS (SELECT 1 FROM grupo_materias propia INNER JOIN docentes d ON d.id = propia.docente_id WHERE propia.grupo_id = g.id AND d.usuario_id = :usuarioId)', { usuarioId: user.sub });
    else { const ids = await this.scope.resolverFiltro(user, q.plantelId); if (ids !== null) grupos.andWhere('g.plantelId IN (:...ids)', { ids }); }
    if (docente && q.plantelId) grupos.andWhere('g.plantelId = :plantel', { plantel: q.plantelId });
    if (q.buscar?.trim()) grupos.andWhere("g.nombre LIKE :buscar ESCAPE '!'", { buscar: '%' + q.buscar.trim().replace(/[!%_[]/g, '!$&') + '%' });
    const joinClases = grupos.clone().leftJoin(GrupoMateria, 'clase', 'clase.grupoId = g.id').leftJoin('clase.docente', 'docente');
    if (docente) joinClases.andWhere('docente.usuarioId = :usuarioId', { usuarioId: user.sub });
    const r = await joinClases.select('COUNT(DISTINCT g.id)', 'grupos').addSelect('COUNT(DISTINCT g.plantelId)', 'planteles').addSelect('COUNT(DISTINCT g.nivelId)', 'niveles').addSelect('COUNT(DISTINCT g.carreraId)', 'planes').addSelect('COUNT(DISTINCT g.periodoAcademicoId)', 'periodos').addSelect('COUNT(DISTINCT clase.id)', 'clases').addSelect('COUNT(DISTINCT clase.materiaId)', 'materias').addSelect('COUNT(DISTINCT clase.docenteId)', 'docentes').getRawOne();
    const clasesQb = this.ds.getRepository(GrupoMateria).createQueryBuilder('gm').leftJoinAndSelect('gm.materia', 'materia').leftJoinAndSelect('gm.grupo', 'cg').leftJoinAndSelect('gm.docente', 'd').leftJoinAndSelect('d.usuario', 'u').where('gm.grupoId IN (' + grupos.clone().select('g.id').getQuery() + ')').setParameters(grupos.getParameters());
    if (docente) clasesQb.andWhere('d.usuarioId = :usuarioId', { usuarioId: user.sub });
    const [clases, totalClases] = await clasesQb.orderBy('gm.id', 'ASC').skip((q.clasesPagina - 1) * q.porPagina).take(q.porPagina).getManyAndCount();
    const [pagina, total] = await grupos.leftJoinAndSelect('g.plantel', 'p').leftJoinAndSelect('g.nivel', 'n').leftJoinAndSelect('g.carrera', 'c').leftJoinAndSelect('g.periodoAcademico', 'pa').orderBy('g.nombre', 'ASC').addOrderBy('g.id', 'ASC').skip((q.pagina - 1) * q.porPagina).take(q.porPagina).getManyAndCount();
    const resumen = Object.fromEntries(['grupos', 'planteles', 'niveles', 'planes', 'periodos', 'clases', 'materias', 'docentes'].map(k => [k, Number(r[k]) || 0]));
    return {
      ciclo: { id: ciclo.id, clave: ciclo.clave, nombre: ciclo.nombre, fechaInicio: ciclo.fechaInicio, fechaFin: ciclo.fechaFin, estado: ciclo.estado }, resumen,
      datos: pagina.map(g => ({ id: g.id, nombre: g.nombre, activo: g.activo, tipo: g.tipo, turno: g.turno, plantel: { id: g.plantel.id, nombre: g.plantel.nombre }, nivel: g.nivel?.nombre ?? null, carrera: g.carrera?.nombre ?? null, plan: g.carrera?.versionPlan ?? null, periodo: g.periodoAcademico?.nombre ?? null })), total, pagina: q.pagina, porPagina: q.porPagina,
      clases: { datos: clases.map(c => ({ id: c.id, grupo: c.grupo.nombre, materia: c.materia.nombre, clave: c.materia.clave, docente: c.docente ? { id: c.docente.id, nombre: [c.docente.usuario.nombre, c.docente.usuario.apellidoPaterno, c.docente.usuario.apellidoMaterno].filter(Boolean).join(' ') } : null })), total: totalClases, pagina: q.clasesPagina, porPagina: q.porPagina },
    };
  }
}
