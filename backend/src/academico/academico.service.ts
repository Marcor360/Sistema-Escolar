import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CicloEscolar } from '../entities/ciclo-escolar.entity';
import { Materia } from '../entities/materia.entity';
import { Grupo } from '../entities/grupo.entity';
import { GrupoMateria } from '../entities/grupo-materia.entity';
import { Inscripcion } from '../entities/inscripcion.entity';
import { Alumno } from '../entities/alumno.entity';
import { DocentesService } from '../docentes/docentes.service';
import { AsignarMateriaDto, CicloDto, GrupoDto, MateriaDto } from './academico.dto';

@Injectable()
export class AcademicoService {
  constructor(
    @InjectRepository(CicloEscolar) private readonly ciclos: Repository<CicloEscolar>,
    @InjectRepository(Materia) private readonly materias: Repository<Materia>,
    @InjectRepository(Grupo) private readonly grupos: Repository<Grupo>,
    @InjectRepository(GrupoMateria) private readonly grupoMaterias: Repository<GrupoMateria>,
    @InjectRepository(Inscripcion) private readonly inscripciones: Repository<Inscripcion>,
    @InjectRepository(Alumno) private readonly alumnos: Repository<Alumno>,
    private readonly docentes: DocentesService,
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
  listarGrupos(cicloId?: number) {
    return this.grupos.find({ where: cicloId ? { cicloId } : {}, order: { nombre: 'ASC' } });
  }
  crearGrupo(dto: GrupoDto) { return this.grupos.save(this.grupos.create(dto)); }

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

  // ---- Inscripciones ----
  async inscribirAlumno(grupoId: number, alumnoId: number) {
    const alumno = await this.alumnos.findOne({ where: { id: alumnoId } });
    if (!alumno) throw new NotFoundException('Alumno no encontrado');
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

  /** Grupos-materia asignados al docente autenticado (panel maestro). */
  async misGrupos(usuarioId: number) {
    const docente = await this.docentes.obtenerPorUsuario(usuarioId);
    return this.grupoMaterias.find({ where: { docenteId: docente.id } });
  }
}
