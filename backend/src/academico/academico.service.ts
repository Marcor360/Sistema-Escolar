import { exigirGrupoVigente, grupoVigente } from '../common/contexto-academico';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { CicloEscolar } from '../entities/ciclo-escolar.entity';
import { Plantel } from '../entities/plantel.entity';
import { Materia } from '../entities/materia.entity';
import { Grupo } from '../entities/grupo.entity';
import { GrupoMateria } from '../entities/grupo-materia.entity';
import { Inscripcion } from '../entities/inscripcion.entity';
import { Alumno } from '../entities/alumno.entity';
import { Docente } from '../entities/docente.entity';
import { Calificacion } from '../entities/calificacion.entity';
import { Actividad } from '../entities/actividad.entity';
import { Material } from '../entities/material.entity';
import { UsuarioPlantel } from '../entities/usuario-plantel.entity';
import { DocentesService } from '../docentes/docentes.service';
import { JwtUser } from '../common/current-user.decorator';
import { ScopeService } from '../planteles/scope.service';
import { ActualizarCicloDto, ActualizarGrupoDto, ActualizarMateriaDto, AsignarMateriaDto, CicloDto, GrupoDto, ListarGruposDto, MateriaDto } from './academico.dto';

function esConflictoUnico(error: unknown): boolean {
  const e = error as { code?: string; errno?: number; number?: number; originalError?: { info?: { number?: number } } };
  return e?.code === 'ER_DUP_ENTRY' || e?.errno === 1062 || e?.number === 2601 || e?.number === 2627 ||
    e?.originalError?.info?.number === 2601 || e?.originalError?.info?.number === 2627;
}

function esConflictoTransaccional(error: unknown): boolean {
  const e = error as {
    code?: string;
    errno?: number;
    number?: number;
    originalError?: { info?: { number?: number } };
    driverError?: {
      code?: string;
      errno?: number;
      number?: number;
      originalError?: { info?: { number?: number } };
    };
  };
  const code = e?.code ?? e?.driverError?.code;
  const errno = e?.errno ?? e?.driverError?.errno;
  const numero = e?.number ?? e?.originalError?.info?.number ??
    e?.driverError?.number ?? e?.driverError?.originalError?.info?.number;
  return code === 'ER_LOCK_DEADLOCK' || code === 'ER_LOCK_WAIT_TIMEOUT' ||
    errno === 1205 || errno === 1213 || numero === 1205 || numero === 1222 || numero === 3960;
}

@Injectable()
export class AcademicoService {
  constructor(
    @InjectRepository(CicloEscolar) private readonly ciclos: Repository<CicloEscolar>,
    @InjectRepository(Materia) private readonly materias: Repository<Materia>,
    @InjectRepository(Grupo) private readonly grupos: Repository<Grupo>,
    @InjectRepository(GrupoMateria) private readonly grupoMaterias: Repository<GrupoMateria>,
    @InjectRepository(Inscripcion) private readonly inscripciones: Repository<Inscripcion>,
    @InjectRepository(Alumno) private readonly alumnos: Repository<Alumno>,
    @InjectRepository(Calificacion) private readonly calificaciones: Repository<Calificacion>,
    @InjectRepository(Actividad) private readonly actividades: Repository<Actividad>,
    @InjectRepository(Material) private readonly materiales: Repository<Material>,
    private readonly docentes: DocentesService,
    private readonly scope: ScopeService,
    @InjectRepository(UsuarioPlantel) private readonly usuarioPlanteles: Repository<UsuarioPlantel>,
    private readonly dataSource: DataSource,
  ) {}

  // ---- Ciclos ----
  listarCiclos() { return this.ciclos.find({ order: { fechaInicio: 'DESC' } }); }

  async crearCiclo(dto: CicloDto) {
    if (dto.fechaFin < dto.fechaInicio) throw new BadRequestException('La fecha de fin debe ser posterior o igual al inicio');
    try {
      return await this.dataSource.transaction('SERIALIZABLE', async (manager) => {
        const ciclos = manager.getRepository(CicloEscolar);
        if (dto.activo) await ciclos.update({ activo: true }, { activo: false });
        return ciclos.save(ciclos.create({ ...dto, activo: dto.activo ?? false }));
      });
    } catch (error) {
      if (esConflictoTransaccional(error)) {
        throw new ConflictException('Otro cambio de ciclo ocurrió al mismo tiempo; vuelve a intentar');
      }
      throw error;
    }
  }

  async actualizarCiclo(id: number, dto: ActualizarCicloDto) {
    try {
      return await this.dataSource.transaction('SERIALIZABLE', async (manager) => {
        const ciclos = manager.getRepository(CicloEscolar);
        const actual = await ciclos.findOne({ where: { id } });
        if (!actual) throw new NotFoundException('Ciclo escolar no encontrado');
        if ((dto.fechaFin ?? actual.fechaFin) < (dto.fechaInicio ?? actual.fechaInicio)) throw new BadRequestException('La fecha de fin debe ser posterior o igual al inicio');
        if (dto.activo) await ciclos.update({ activo: true }, { activo: false });
        await ciclos.update(id, dto);
        return ciclos.findOne({ where: { id } });
      });
    } catch (error) {
      if (esConflictoTransaccional(error)) {
        throw new ConflictException('Otro cambio de ciclo ocurrió al mismo tiempo; vuelve a intentar');
      }
      throw error;
    }
  }

  // ---- Materias ----
  listarMaterias() { return this.materias.find({ where: { activo: true }, order: { clave: 'ASC' } }); }
  crearMateria(dto: MateriaDto) { return this.materias.save(this.materias.create(dto)); }
  async actualizarMateria(id: number, dto: ActualizarMateriaDto) {
    await this.materias.update(id, dto);
    return this.materias.findOne({ where: { id } });
  }
  async desactivarMateria(id: number) {
    const materia = await this.materias.findOne({ where: { id } });
    if (!materia) throw new NotFoundException('Materia no encontrada');
    const clases = await this.grupoMaterias.count({ where: { materiaId: id, grupo: { activo: true, ciclo: { activo: true } } } });
    if (clases) throw new ConflictException('Primero retira la materia de los grupos vigentes; no se elimina el historial');
    await this.materias.update(id, { activo: false });
    return { ok: true };
  }

  // ---- Grupos ----
  async listarGrupos(user: JwtUser, query: ListarGruposDto) {
    const pagina = query.pagina || 1;
    const porPagina = query.porPagina || 20;
    const maestroPuro = this.esMaestroLimitado(user);
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
    const ciclo = await this.ciclos.findOne({ where: { id: dto.cicloId, activo: true } });
    if (!ciclo) throw new ConflictException('Selecciona un ciclo existente y activo');
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

  /** Baja lógica: se rechaza si el grupo tiene inscripciones activas. */
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

  /** Todas las asignaciones grupo-materia (captura de calificaciones del administrativo). */
  async listarGrupoMaterias(user: JwtUser) {
    const planteles = await this.scope.plantelesDe(user);
    const docenteId = this.esMaestroLimitado(user)
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
    if (this.esMaestroLimitado(user)) {
      const docente = await this.docentes.obtenerPorUsuario(user.sub);
      return this.grupoMaterias.find({ where: { grupoId, docenteId: docente.id } });
    }
    return this.grupoMaterias.find({ where: { grupoId } });
  }

  /** Asigna una materia al grupo y, opcionalmente, el docente que la imparte. */
  async asignarMateria(grupoId: number, dto: AsignarMateriaDto, user: JwtUser) {
    const grupo = await this.grupos.findOne({ where: { id: grupoId } });
    if (!grupo) throw new NotFoundException('Grupo no encontrado');
    await this.scope.validarGestion(user, grupo.plantelId);
    if (!grupo.activo) throw new ConflictException('No se puede asignar una materia a un grupo inactivo');
    exigirGrupoVigente(grupo);
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
    exigirGrupoVigente(gm.grupo);
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
      return { ...gm, docenteId, docente: actual };
    });
  }

  /** Quita una materia asignada por error; rechaza si ya tiene trabajo académico registrado. */
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

  // ---- Inscripciones ----
  async inscribirAlumno(grupoId: number, alumnoId: number, user: JwtUser) {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const grupo = await manager.getRepository(Grupo).findOne({
          where: { id: grupoId }, lock: { mode: 'pessimistic_write' },
        });
        if (!grupo) throw new NotFoundException('Grupo no encontrado');
        await this.scope.validarGestion(user, grupo.plantelId);
        if (!grupo.activo) throw new ConflictException('No se puede inscribir en un grupo inactivo');
        const alumno = await manager.getRepository(Alumno).findOne({ where: { id: alumnoId }, lock: { mode: 'pessimistic_write' } });
        if (!alumno) throw new NotFoundException('Alumno no encontrado');
        if (alumno.estatus !== 'ACTIVO') throw new ConflictException('El alumno no está activo');
        exigirGrupoVigente(grupo);
        if (!alumno.usuario.activo) throw new ConflictException('La cuenta del alumno no está activa');
        if (alumno.plantelId !== grupo.plantelId) {
          throw new ForbiddenException('El alumno no pertenece al plantel del grupo');
        }
        const inscripciones = manager.getRepository(Inscripcion);
        const otra = await inscripciones.findOne({ where: { alumnoId, estatus: 'ACTIVA', grupo: { cicloId: grupo.cicloId } } });
        if (otra) throw new ConflictException('El alumno ya tiene una inscripción activa en este ciclo; corrige la inscripción anterior');
        const duplicada = await inscripciones.findOne({ where: { grupoId, alumnoId } });
        if (duplicada) {
          duplicada.estatus = 'ACTIVA';
          return inscripciones.save(duplicada);
        }
        return inscripciones.save(inscripciones.create({ grupoId, alumnoId }));
      });
    } catch (error) {
      if (esConflictoUnico(error) || esConflictoTransaccional(error)) throw new ConflictException('La inscripción cambió al mismo tiempo; vuelve a consultar');
      throw error;
    }
  }

  async alumnosDeGrupo(grupoId: number, user: JwtUser) {
    await this.validarAccesoGrupo(grupoId, user);
    const inscripciones = await this.inscripciones.find({ where: { grupoId, estatus: 'ACTIVA' } });
    return inscripciones.map((inscripcion) => ({
      id: inscripcion.id,
      alumnoId: inscripcion.alumnoId,
      grupoId: inscripcion.grupoId,
      estatus: inscripcion.estatus,
      fechaInscripcion: inscripcion.fechaInscripcion,
      alumno: {
        id: inscripcion.alumno.id,
        matricula: inscripcion.alumno.matricula,
        estatus: inscripcion.alumno.estatus,
        usuario: {
          nombre: inscripcion.alumno.usuario.nombre,
          apellidoPaterno: inscripcion.alumno.usuario.apellidoPaterno,
        },
      },
    }));
  }

  async bajaInscripcion(id: number, user: JwtUser) {
    const inscripcion = await this.inscripciones.findOne({ where: { id } });
    if (!inscripcion) throw new NotFoundException('Inscripción no encontrada');
    await this.validarAccesoGrupo(inscripcion.grupoId, user);
    await this.inscripciones.update(id, { estatus: 'BAJA' });
    return { ok: true };
  }

  private esMaestroLimitado(user: JwtUser): boolean {
    return user.roles.includes('MAESTRO') &&
      !user.roles.some((rol) => ['SUPERADMIN', 'ADMINISTRATIVO', 'FINANZAS'].includes(rol));
  }

  private async validarAccesoGrupo(grupoId: number, user: JwtUser): Promise<void> {
    const grupo = await this.grupos.findOne({ where: { id: grupoId } });
    if (!grupo) throw new NotFoundException('Grupo no encontrado');
    if (!this.esMaestroLimitado(user)) {
      await this.scope.validarGestion(user, grupo.plantelId);
      return;
    }
    const docente = await this.docentes.obtenerPorUsuario(user.sub);
    const asignacion = await this.grupoMaterias.findOne({ where: { grupoId, docenteId: docente.id } });
    if (!asignacion) throw new ForbiddenException('El grupo no está asignado a este docente');
    if (!grupo.activo) throw new ForbiddenException('El grupo no está activo');
  }

  /** Grupos-materia asignados al docente autenticado (panel maestro); excluye grupos dados de baja. */
  async misGrupos(usuarioId: number) {
    const docente = await this.docentes.obtenerPorUsuario(usuarioId);
    const asignaciones = await this.grupoMaterias.find({ where: { docenteId: docente.id } });
    return asignaciones.filter((gm) => grupoVigente(gm.grupo) && gm.materia.activo);
  }
}
