import { esMaestroRestringido, exigirConsultaAcademica } from '../common/politica-acceso';
import { BitacoraAcademica } from '../entities/bitacora-academica.entity';
import { exigirGrupoConfigurable, grupoVigente } from '../common/contexto-academico';
import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Like, In, Repository } from 'typeorm';
import { CicloEscolar } from '../entities/ciclo-escolar.entity';
import { Plantel } from '../entities/plantel.entity';
import { Materia } from '../entities/materia.entity';
import { Grupo } from '../entities/grupo.entity';
import { GrupoMateria } from '../entities/grupo-materia.entity';
import { Inscripcion } from '../entities/inscripcion.entity';
import { Docente } from '../entities/docente.entity';
import { Calificacion } from '../entities/calificacion.entity';
import { Actividad } from '../entities/actividad.entity';
import { Material } from '../entities/material.entity';
import { UsuarioPlantel } from '../entities/usuario-plantel.entity';
import { DocentesService } from '../docentes/docentes.service';
import { JwtUser } from '../common/current-user.decorator';
import { ScopeService } from '../planteles/scope.service';
import { ActualizarGrupoDto, AsignarMateriaDto, GrupoDto, ListarGruposDto } from './academico.dto';
import { esConflictoUnico } from './conflictos';
@Injectable()
export class GruposService {
 constructor(@InjectRepository(CicloEscolar) private readonly ciclos: Repository<CicloEscolar>,
@InjectRepository(Materia) private readonly materias: Repository<Materia>,
@InjectRepository(Grupo) private readonly grupos: Repository<Grupo>,
@InjectRepository(GrupoMateria) private readonly grupoMaterias: Repository<GrupoMateria>,
@InjectRepository(Inscripcion) private readonly inscripciones: Repository<Inscripcion>,
@InjectRepository(Calificacion) private readonly calificaciones: Repository<Calificacion>,
@InjectRepository(Actividad) private readonly actividades: Repository<Actividad>,
@InjectRepository(Material) private readonly materiales: Repository<Material>,
private readonly docentes: DocentesService,
private readonly scope: ScopeService,
@InjectRepository(UsuarioPlantel) private readonly usuarioPlanteles: Repository<UsuarioPlantel>,
private readonly dataSource: DataSource) {}
async listarGrupos(user: JwtUser, query: ListarGruposDto) {
    const pagina = query.pagina || 1;
    const porPagina = query.porPagina || 20;
    const maestroPuro = esMaestroRestringido(user);
    const planteles = maestroPuro ? null : await this.scope.resolverFiltro(user, query.plantelId);
    const puedeVerInactivos = user.roles.includes('ADMINISTRATIVO') || user.roles.includes('SUPERADMIN');
    const docente = maestroPuro ? await this.docentes.obtenerPorUsuario(user.sub) : null;
    const grupoMateriaIds = docente
      ? await this.grupoMaterias.find({ where: { docenteId: docente.id } })
      : [];
    const gruposDocente = [...new Set(grupoMateriaIds.map((gm) => gm.grupoId))];
    if (maestroPuro && gruposDocente.length === 0) return { datos: [], total: 0, pagina, porPagina };
    const [datos, total] = await this.grupos.findAndCount({
      where: {
        ...(maestroPuro ? { id: In(gruposDocente) } : {}),
        ...(query.buscar ? { nombre: Like(`%${query.buscar}%`) } : {}),
        ...(query.cicloId ? { cicloId: query.cicloId } : { ciclo: { activo: true }, plantel: { activo: true } }),
        ...(planteles === null ? {} : { plantelId: In(planteles) }),
        ...(query.inactivos && puedeVerInactivos ? {} : { activo: true }),
      },
      order: { id: 'DESC' },
      skip: (pagina - 1) * porPagina,
      take: porPagina,
    });
    return { datos, total, pagina, porPagina };
  }

async crearGrupo(dto: GrupoDto, user: JwtUser) {
    await this.scope.validarGestion(user, dto.plantelId);
    const ciclo = await this.ciclos.findOne({ where: { id: dto.cicloId } });
    if (!ciclo || ciclo.estado === 'CERRADO' || ciclo.estado === 'EN_CIERRE') throw new ConflictException('Selecciona un ciclo activo o en preparación');
    const plantel = await this.dataSource.getRepository(Plantel).findOne({ where: { id: dto.plantelId, activo: true } });
    if (!plantel) throw new ConflictException('El plantel no está activo');
    try {
      return await this.grupos.save(this.grupos.create(dto));
    } catch (error) {
      if (esConflictoUnico(error)) throw new ConflictException('Ya existe un grupo con ese nombre en el ciclo');
      throw error;
    }
  }

async actualizarGrupo(id: number, dto: ActualizarGrupoDto, user: JwtUser) {
    const grupo = await this.grupos.findOne({ where: { id } });
    if (!grupo) throw new NotFoundException('Grupo no encontrado');
    await this.scope.validarGestion(user, grupo.plantelId);
    if (dto.cicloId !== undefined && dto.cicloId !== grupo.cicloId) {
      throw new ConflictException('El ciclo del grupo es inmutable; crea un grupo en el ciclo de destino');
    }
    if ((dto.grado !== undefined && dto.grado !== grupo.grado) || (dto.turno !== undefined && dto.turno !== grupo.turno)) {
      const inscritos = await this.inscripciones.count({ where: { grupoId: id } });
      if (inscritos) throw new ConflictException('No puedes cambiar grado o turno de un grupo con inscripciones');
    }
    try {
      await this.grupos.update(id, dto);
    } catch (error) {
      if (esConflictoUnico(error)) throw new ConflictException('Ya existe un grupo con ese nombre en el ciclo');
      throw error;
    }
    return this.grupos.findOne({ where: { id } });
  }

async eliminarGrupo(id: number, user: JwtUser) {
    return this.dataSource.transaction(async (manager) => {
      const grupos = manager.getRepository(Grupo);
      const grupo = await grupos.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!grupo) throw new NotFoundException('Grupo no encontrado');
      await this.scope.validarGestion(user, grupo.plantelId);
      const inscripcionesActivas = await manager.getRepository(Inscripcion).count({
        where: { grupoId: id, estatus: 'ACTIVA' },
      });
      if (inscripcionesActivas > 0) {
        throw new ConflictException(
          `El grupo tiene ${inscripcionesActivas} inscripción(es) activa(s); dalas de baja antes de eliminar el grupo`,
        );
      }
      await grupos.update(id, { activo: false });
      return { ok: true };
    });
  }

/** Selector operativo paginado: mantiene alcance de maestro aun con roles financieros. */
async clasesParaSeleccion(user: JwtUser, query: ListarGruposDto) {
    exigirConsultaAcademica(user);
    const planteles = await this.scope.plantelesDe(user);
    const docenteId = esMaestroRestringido(user) ? (await this.docentes.obtenerPorUsuario(user.sub)).id : null;
    if (planteles?.length === 0) return { datos: [], total: 0, pagina: query.pagina, porPagina: query.porPagina };
    const qb = this.grupoMaterias.createQueryBuilder('gm').innerJoinAndSelect('gm.grupo','g')
      .innerJoinAndSelect('g.ciclo','c').innerJoinAndSelect('g.plantel','p').innerJoinAndSelect('gm.materia','m')
      .where('g.activo = :si AND c.activo = :si AND p.activo = :si AND m.activo = :si',{ si: true });
    if (planteles !== null) qb.andWhere('g.plantel_id IN (:...planteles)',{ planteles });
    if (docenteId !== null) qb.andWhere('gm.docente_id = :docenteId',{ docenteId });
    if (query.plantelId) { await this.scope.validarGestion(user,query.plantelId); qb.andWhere('g.plantel_id = :plantelId',{ plantelId: query.plantelId }); }
    if (query.cicloId) qb.andWhere('g.ciclo_id = :cicloId',{ cicloId: query.cicloId });
    if (query.buscar) qb.andWhere('(g.nombre LIKE :buscar OR m.nombre LIKE :buscar OR m.clave LIKE :buscar OR p.nombre LIKE :buscar)',{ buscar: `%${query.buscar}%` });
    const [datos,total] = await qb.orderBy('g.nombre','ASC').addOrderBy('gm.id','ASC').skip((query.pagina-1)*query.porPagina).take(query.porPagina).getManyAndCount();
    return { datos,total,pagina: query.pagina,porPagina: query.porPagina };
  }

async listarGrupoMaterias(user: JwtUser) {
    const planteles = await this.scope.plantelesDe(user);
    const docenteId = esMaestroRestringido(user)
      ? (await this.docentes.obtenerPorUsuario(user.sub)).id
      : null;
    if (planteles?.length === 0) return [];
    return this.grupoMaterias.find({
      where: {
        grupo: { activo: true, ciclo: { activo: true }, plantel: { activo: true }, ...(planteles === null ? {} : { plantelId: In(planteles) }) },
        materia: { activo: true },
        ...(docenteId === null ? {} : { docenteId }),
      },
      order: { grupoId: 'ASC' },
    });
  }

async materiasDeGrupo(grupoId: number, user: JwtUser) {
    await this.validarAccesoGrupo(grupoId, user);
    if (esMaestroRestringido(user)) {
      const docente = await this.docentes.obtenerPorUsuario(user.sub);
      return this.grupoMaterias.find({ where: { grupoId, docenteId: docente.id } });
    }
    return this.grupoMaterias.find({ where: { grupoId } });
  }

async asignarMateria(grupoId: number, dto: AsignarMateriaDto, user: JwtUser) {
    const grupo = await this.grupos.findOne({ where: { id: grupoId } });
    if (!grupo) throw new NotFoundException('Grupo no encontrado');
    await this.scope.validarGestion(user, grupo.plantelId);
    if (!grupo.activo) throw new ConflictException('No se puede asignar una materia a un grupo inactivo');
    exigirGrupoConfigurable(grupo);
    const materia = await this.materias.findOne({ where: { id: dto.materiaId, activo: true } });
    if (!materia) throw new ConflictException('La materia no está activa');
    const duplicado = await this.grupoMaterias.findOne({
      where: { grupoId, materiaId: dto.materiaId },
    });
    if (duplicado) throw new ConflictException('La materia ya está asignada a este grupo');
    if (dto.docenteId !== undefined) {
      const docente = await this.docentes.obtener(dto.docenteId, user);
      if (docente.estatus !== 'ACTIVO' || !docente.usuario.activo) throw new ConflictException('El docente no está activo');
      {
        const asignacion = await this.usuarioPlanteles.findOne({
          where: { usuarioId: docente.usuarioId, plantelId: grupo.plantelId, activo: true },
        });
        if (!asignacion) throw new ForbiddenException('El docente no está asignado al plantel del grupo');
      }
    }
    try {
      return await this.dataSource.transaction(async (manager) => {
        if (dto.docenteId !== undefined) {
          const actual = await manager.getRepository(Docente).findOne({ where: { id: dto.docenteId }, lock: { mode: 'pessimistic_write' } });
          if (!actual || actual.estatus !== 'ACTIVO' || !actual.usuario.activo) throw new ConflictException('El docente no está activo');
          if (!await manager.getRepository(UsuarioPlantel).findOneBy({ usuarioId: actual.usuarioId, plantelId: grupo.plantelId, activo: true })) throw new ConflictException('El docente ya no está asignado al plantel');
        }
        const repositorio = manager.getRepository(GrupoMateria);
        return repositorio.save(repositorio.create({ grupoId, materiaId: dto.materiaId, docenteId: dto.docenteId ?? null }));
      });
    } catch (error) {
      if (esConflictoUnico(error)) throw new ConflictException('La materia ya está asignada a este grupo');
      throw error;
    }
  }

async asignarDocente(grupoMateriaId: number, docenteId: number, user: JwtUser) {
    const gm = await this.grupoMaterias.findOne({ where: { id: grupoMateriaId } });
    if (!gm) throw new NotFoundException('Asignación grupo-materia no encontrada');
    await this.validarAccesoGrupo(gm.grupoId, user);
    exigirGrupoConfigurable(gm.grupo);
    if (!gm.materia.activo) throw new ConflictException('La materia no está activa');
    const docente = await this.docentes.obtener(docenteId, user);
    if (docente.estatus !== 'ACTIVO' || !docente.usuario.activo) throw new ConflictException('El docente no está activo');
    {
      const asignacion = await this.usuarioPlanteles.findOne({
        where: { usuarioId: docente.usuarioId, plantelId: gm.grupo.plantelId, activo: true },
      });
      if (!asignacion) throw new ForbiddenException('El docente no está asignado al plantel del grupo');
    }
    return this.dataSource.transaction(async (manager) => {
      const actual = await manager.getRepository(Docente).findOne({ where: { id: docenteId }, lock: { mode: 'pessimistic_write' } });
      if (!actual || actual.estatus !== 'ACTIVO' || !actual.usuario.activo) throw new ConflictException('El docente no está activo');
      if (!await manager.getRepository(UsuarioPlantel).findOneBy({ usuarioId: actual.usuarioId, plantelId: gm.grupo.plantelId, activo: true })) throw new ConflictException('El docente ya no está asignado al plantel');
      await manager.getRepository(GrupoMateria).update({ id: grupoMateriaId }, { docenteId });
      await manager.getRepository(BitacoraAcademica).insert({ usuarioId: user.sub, plantelId: gm.grupo.plantelId, accion: 'DOCENTE_REASIGNADO', entidadId: grupoMateriaId, detalle: `anteriorDocenteId=${gm.docenteId ?? 'sin asignar'}; docenteId=${docenteId}`, fecha: new Date() });
      return { ...gm, docenteId, docente: actual };
    });
  }

async eliminarGrupoMateria(id: number, user: JwtUser) {
    const gm = await this.grupoMaterias.findOne({ where: { id } });
    if (!gm) throw new NotFoundException('Asignación grupo-materia no encontrada');
    await this.scope.validarGestion(user, gm.grupo.plantelId);

    const [calificaciones, actividades, materiales] = await Promise.all([
      this.calificaciones.count({ where: { grupoMateriaId: id } }),
      this.actividades.count({ where: { grupoMateriaId: id } }),
      this.materiales.count({ where: { grupoMateriaId: id } }),
    ]);
    const bloqueos: string[] = [];
    if (calificaciones > 0) bloqueos.push(`${calificaciones} calificación(es)`);
    if (actividades > 0) bloqueos.push(`${actividades} actividad(es)`);
    if (materiales > 0) bloqueos.push(`${materiales} material(es)`);
    if (bloqueos.length > 0) {
      throw new ConflictException(`No se puede quitar la materia: tiene ${bloqueos.join(', ')} asociados`);
    }
    await this.grupoMaterias.delete(id);
    return { ok: true };
  }

async validarAccesoGrupo(grupoId: number, user: JwtUser): Promise<void> {
    const grupo = await this.grupos.findOne({ where: { id: grupoId } });
    if (!grupo) throw new NotFoundException('Grupo no encontrado');
    if (!esMaestroRestringido(user)) {
      await this.scope.validarGestion(user, grupo.plantelId);
      return;
    }
    const docente = await this.docentes.obtenerPorUsuario(user.sub);
    const asignacion = await this.grupoMaterias.findOne({ where: { grupoId, docenteId: docente.id } });
    if (!asignacion) throw new ForbiddenException('El grupo no está asignado a este docente');
    if (!grupo.activo) throw new ForbiddenException('El grupo no está activo');
  }

async misGrupos(usuarioId: number) {
    const docente = await this.docentes.obtenerPorUsuario(usuarioId);
    const asignaciones = await this.grupoMaterias.find({ where: { docenteId: docente.id } });
    return asignaciones.filter((gm) => grupoVigente(gm.grupo) && gm.materia.activo);
  }
}
