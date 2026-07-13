import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CicloEscolar } from '../entities/ciclo-escolar.entity';
import { Materia } from '../entities/materia.entity';
import { Grupo } from '../entities/grupo.entity';
import { GrupoMateria } from '../entities/grupo-materia.entity';
import { Inscripcion } from '../entities/inscripcion.entity';
import { Alumno } from '../entities/alumno.entity';
import { Calificacion } from '../entities/calificacion.entity';
import { Actividad } from '../entities/actividad.entity';
import { Material } from '../entities/material.entity';
import { DocentesService } from '../docentes/docentes.service';
import { JwtUser } from '../common/current-user.decorator';
import { ScopeService } from '../planteles/scope.service';
import { ActualizarGrupoDto, AsignarMateriaDto, CicloDto, GrupoDto, ListarGruposDto, MateriaDto } from './academico.dto';

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
  ) {}

  // ---- Ciclos ----
  listarCiclos() { return this.ciclos.find({ order: { fechaInicio: 'DESC' } }); }

  async crearCiclo(dto: CicloDto) {
    if (dto.activo) await this.ciclos.update({ activo: true }, { activo: false });
    return this.ciclos.save(this.ciclos.create({ ...dto, activo: dto.activo ?? false }));
  }

  async actualizarCiclo(id: number, dto: Partial<CicloDto>) {
    if (dto.activo) await this.ciclos.update({ activo: true }, { activo: false });
    await this.ciclos.update(id, dto);
    return this.ciclos.findOne({ where: { id } });
  }

  // ---- Materias ----
  listarMaterias() { return this.materias.find({ where: { activo: true }, order: { clave: 'ASC' } }); }
  crearMateria(dto: MateriaDto) { return this.materias.save(this.materias.create(dto)); }
  async actualizarMateria(id: number, dto: Partial<MateriaDto>) {
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
    const planteles = await this.scope.resolverFiltro(user, query.plantelId);
    const puedeVerInactivos = user.roles.includes('ADMINISTRATIVO') || user.roles.includes('SUPERADMIN');
    const [datos, total] = await this.grupos.findAndCount({
      where: {
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
    return this.grupos.save(this.grupos.create(dto));
  }

  async actualizarGrupo(id: number, dto: ActualizarGrupoDto, user: JwtUser) {
    const grupo = await this.grupos.findOne({ where: { id } });
    if (!grupo) throw new NotFoundException('Grupo no encontrado');
    await this.scope.validarGestion(user, grupo.plantelId);
    await this.grupos.update(id, dto);
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
  listarGrupoMaterias() {
    return this.grupoMaterias.find({ order: { grupoId: 'ASC' } });
  }

  async materiasDeGrupo(grupoId: number) {
    return this.grupoMaterias.find({ where: { grupoId } });
  }

  /** Asigna una materia al grupo y, opcionalmente, el docente que la imparte. */
  async asignarMateria(grupoId: number, dto: AsignarMateriaDto) {
    const duplicado = await this.grupoMaterias.findOne({
      where: { grupoId, materiaId: dto.materiaId },
    });
    if (duplicado) throw new ConflictException('La materia ya está asignada a este grupo');
    return this.grupoMaterias.save(
      this.grupoMaterias.create({ grupoId, materiaId: dto.materiaId, docenteId: dto.docenteId ?? null }),
    );
  }

  async asignarDocente(grupoMateriaId: number, docenteId: number) {
    const gm = await this.grupoMaterias.findOne({ where: { id: grupoMateriaId } });
    if (!gm) throw new NotFoundException('Asignación grupo-materia no encontrada');
    await this.docentes.obtener(docenteId);
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
  async inscribirAlumno(grupoId: number, alumnoId: number, user?: JwtUser) {
    const grupo = await this.grupos.findOne({ where: { id: grupoId } });
    if (!grupo) throw new NotFoundException('Grupo no encontrado');
    if (user) await this.scope.validarGestion(user, grupo.plantelId);
    const alumno = await this.alumnos.findOne({ where: { id: alumnoId } });
    if (!alumno) throw new NotFoundException('Alumno no encontrado');
    if (alumno.plantelId !== grupo.plantelId) throw new ForbiddenException('El alumno no pertenece al plantel del grupo');
    const duplicada = await this.inscripciones.findOne({ where: { grupoId, alumnoId } });
    if (duplicada) throw new ConflictException('El alumno ya está inscrito en este grupo');
    return this.inscripciones.save(this.inscripciones.create({ grupoId, alumnoId }));
  }

  alumnosDeGrupo(grupoId: number) {
    return this.inscripciones.find({ where: { grupoId, estatus: 'ACTIVA' } });
  }

  async bajaInscripcion(id: number) {
    await this.inscripciones.update(id, { estatus: 'BAJA' });
    return { ok: true };
  }

  /** Grupos-materia asignados al docente autenticado (panel maestro); excluye grupos dados de baja. */
  async misGrupos(usuarioId: number) {
    const docente = await this.docentes.obtenerPorUsuario(usuarioId);
    const asignaciones = await this.grupoMaterias.find({ where: { docenteId: docente.id } });
    return asignaciones.filter((gm) => gm.grupo.activo);
  }
}
