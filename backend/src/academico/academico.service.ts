import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { CicloEscolar } from '../entities/ciclo-escolar.entity';
import { Materia } from '../entities/materia.entity';
import { Grupo } from '../entities/grupo.entity';
import { GrupoMateria } from '../entities/grupo-materia.entity';
import { Inscripcion } from '../entities/inscripcion.entity';
import { Alumno } from '../entities/alumno.entity';
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
    return this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      const ciclos = manager.getRepository(CicloEscolar);
      if (dto.activo) await ciclos.update({ activo: true }, { activo: false });
      return ciclos.save(ciclos.create({ ...dto, activo: dto.activo ?? false }));
    });
  }

  async actualizarCiclo(id: number, dto: ActualizarCicloDto) {
    return this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      const ciclos = manager.getRepository(CicloEscolar);
      const actual = await ciclos.findOne({ where: { id } });
      if (!actual) throw new NotFoundException('Ciclo escolar no encontrado');
      if (dto.activo) await ciclos.update({ activo: true }, { activo: false });
      await ciclos.update(id, dto);
      return ciclos.findOne({ where: { id } });
    });
  }

  // ---- Materias ----
  listarMaterias() { return this.materias.find({ where: { activo: true }, order: { clave: 'ASC' } }); }
  crearMateria(dto: MateriaDto) { return this.materias.save(this.materias.create(dto)); }
  async actualizarMateria(id: number, dto: ActualizarMateriaDto) {
    await this.materias.update(id, dto);
    return this.materias.findOne({ where: { id } });
  }
  async desactivarMateria(id: number) {
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
        ...(query.cicloId ? { cicloId: query.cicloId } : {}),
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
    const grupo = await this.grupos.findOne({ where: { id } });
    if (!grupo) throw new NotFoundException('Grupo no encontrado');
    await this.scope.validarGestion(user, grupo.plantelId);
    const inscripcionesActivas = await this.inscripciones.count({ where: { grupoId: id, estatus: 'ACTIVA' } });
    if (inscripcionesActivas > 0) {
      throw new ConflictException(
        `El grupo tiene ${inscripcionesActivas} inscripción(es) activa(s); dalas de baja antes de eliminar el grupo`,
      );
    }
    await this.grupos.update(id, { activo: false });
    return { ok: true };
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
        ...(planteles === null ? {} : { grupo: { plantelId: In(planteles) } }),
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
    const duplicado = await this.grupoMaterias.findOne({
      where: { grupoId, materiaId: dto.materiaId },
    });
    if (duplicado) throw new ConflictException('La materia ya está asignada a este grupo');
    if (dto.docenteId !== undefined) {
      const docente = await this.docentes.obtener(dto.docenteId, user);
      if (!user.roles.includes('SUPERADMIN')) {
        const asignacion = await this.usuarioPlanteles.findOne({
          where: { usuarioId: docente.usuarioId, plantelId: grupo.plantelId, activo: true },
        });
        if (!asignacion) throw new ForbiddenException('El docente no está asignado al plantel del grupo');
      }
    }
    try {
      return await this.grupoMaterias.save(
        this.grupoMaterias.create({ grupoId, materiaId: dto.materiaId, docenteId: dto.docenteId ?? null }),
      );
    } catch (error) {
      if (esConflictoUnico(error)) throw new ConflictException('La materia ya está asignada a este grupo');
      throw error;
    }
  }

  async asignarDocente(grupoMateriaId: number, docenteId: number, user: JwtUser) {
    const gm = await this.grupoMaterias.findOne({ where: { id: grupoMateriaId } });
    if (!gm) throw new NotFoundException('Asignación grupo-materia no encontrada');
    await this.validarAccesoGrupo(gm.grupoId, user);
    const docente = await this.docentes.obtener(docenteId, user);
    if (!user.roles.includes('SUPERADMIN')) {
      const asignacion = await this.usuarioPlanteles.findOne({
        where: { usuarioId: docente.usuarioId, plantelId: gm.grupo.plantelId, activo: true },
      });
      if (!asignacion) throw new ForbiddenException('El docente no está asignado al plantel del grupo');
    }
    gm.docenteId = docenteId;
    return this.grupoMaterias.save(gm);
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
    const grupo = await this.grupos.findOne({ where: { id: grupoId } });
    if (!grupo) throw new NotFoundException('Grupo no encontrado');
    await this.scope.validarGestion(user, grupo.plantelId);
    const alumno = await this.alumnos.findOne({ where: { id: alumnoId } });
    if (!alumno) throw new NotFoundException('Alumno no encontrado');
    if (alumno.plantelId !== grupo.plantelId) throw new ForbiddenException('El alumno no pertenece al plantel del grupo');
    const duplicada = await this.inscripciones.findOne({ where: { grupoId, alumnoId } });
    if (duplicada) throw new ConflictException('El alumno ya está inscrito en este grupo');
    try {
      return await this.inscripciones.save(this.inscripciones.create({ grupoId, alumnoId }));
    } catch (error) {
      if (esConflictoUnico(error)) throw new ConflictException('El alumno ya está inscrito en este grupo');
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
    return asignaciones.filter((gm) => gm.grupo.activo);
  }
}
