import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Actividad } from '../entities/actividad.entity';
import { Entrega } from '../entities/entrega.entity';
import { Material } from '../entities/material.entity';
import { GrupoMateria } from '../entities/grupo-materia.entity';
import { Inscripcion } from '../entities/inscripcion.entity';
import { AlumnosService } from '../alumnos/alumnos.service';
import { DocentesService } from '../docentes/docentes.service';
import { JwtUser } from '../common/current-user.decorator';
import { ActualizarActividadDto, CalificarEntregaDto, CrearActividadDto, EntregarDto } from './actividades.dto';
import { ScopeService } from '../planteles/scope.service';

@Injectable()
export class ActividadesService {
  constructor(
    @InjectRepository(Actividad) private readonly actividades: Repository<Actividad>,
    @InjectRepository(Entrega) private readonly entregas: Repository<Entrega>,
    @InjectRepository(Material) private readonly materiales: Repository<Material>,
    @InjectRepository(GrupoMateria) private readonly grupoMaterias: Repository<GrupoMateria>,
    @InjectRepository(Inscripcion) private readonly inscripciones: Repository<Inscripcion>,
    private readonly alumnos: AlumnosService,
    private readonly docentes: DocentesService,
    private readonly scope: ScopeService,
  ) {}

  /** El maestro solo opera sobre sus grupos-materia; ADMINISTRATIVO y SUPERADMIN, sobre todos. */
  private async validarPropiedad(grupoMateriaId: number, user: JwtUser): Promise<GrupoMateria> {
    const gm = await this.grupoMaterias.findOne({ where: { id: grupoMateriaId } });
    if (!gm) throw new NotFoundException('Grupo-materia no encontrado');
    if (user.roles.includes('SUPERADMIN')) return gm;
    if (user.roles.includes('ADMINISTRATIVO')) {
      await this.scope.validarGestion(user, gm.grupo.plantelId);
      return gm;
    }
    const docente = await this.docentes.obtenerPorUsuario(user.sub);
    if (gm.docenteId !== docente.id) {
      throw new ForbiddenException('La materia no está asignada a este docente');
    }
    return gm;
  }

  private async validarAlumnoEnGrupoMateria(grupoMateriaId: number, user: JwtUser) {
    const alumno = await this.alumnos.obtenerPorUsuario(user.sub);
    const gm = await this.grupoMaterias.findOne({ where: { id: grupoMateriaId } });
    if (!gm) throw new NotFoundException('Grupo-materia no encontrado');
    const inscripcion = await this.inscripciones.findOne({
      where: { alumnoId: alumno.id, grupoId: gm.grupoId, estatus: 'ACTIVA' },
    });
    if (!inscripcion) throw new ForbiddenException('El alumno no está inscrito en el grupo de esta actividad');
    return { alumno, gm };
  }

  async listarPorGrupoMateria(grupoMateriaId: number, user: JwtUser) {
    if (user.roles.includes('ALUMNO')) await this.validarAlumnoEnGrupoMateria(grupoMateriaId, user);
    else await this.validarPropiedad(grupoMateriaId, user);
    return this.actividades.find({
      where: { grupoMateriaId, activo: true },
      order: { fechaEntrega: 'ASC' },
    });
  }

  async crear(dto: CrearActividadDto, user: JwtUser) {
    await this.validarPropiedad(dto.grupoMateriaId, user);
    return this.actividades.save(
      this.actividades.create({
        grupoMateriaId: dto.grupoMateriaId,
        titulo: dto.titulo,
        descripcion: dto.descripcion ?? null,
        tipo: dto.tipo ?? 'TAREA',
        parcial: dto.parcial ?? 1,
        ponderacion: dto.ponderacion ?? 0,
        fechaEntrega: dto.fechaEntrega ? new Date(dto.fechaEntrega) : null,
      }),
    );
  }

  async actualizar(id: number, dto: ActualizarActividadDto, user: JwtUser) {
    const actividad = await this.obtener(id);
    await this.validarPropiedad(actividad.grupoMateriaId, user);
    Object.assign(actividad, {
      titulo: dto.titulo ?? actividad.titulo,
      descripcion: dto.descripcion ?? actividad.descripcion,
      tipo: dto.tipo ?? actividad.tipo,
      parcial: dto.parcial ?? actividad.parcial,
      ponderacion: dto.ponderacion ?? actividad.ponderacion,
      fechaEntrega: dto.fechaEntrega ? new Date(dto.fechaEntrega) : actividad.fechaEntrega,
    });
    return this.actividades.save(actividad);
  }

  async desactivar(id: number, user: JwtUser) {
    const actividad = await this.obtener(id);
    await this.validarPropiedad(actividad.grupoMateriaId, user);
    await this.actividades.update(id, { activo: false });
    return { ok: true };
  }

  async obtener(id: number) {
    const actividad = await this.actividades.findOne({ where: { id } });
    if (!actividad) throw new NotFoundException('Actividad no encontrada');
    return actividad;
  }

  // ---- Entregas ----
  async entregar(actividadId: number, user: JwtUser, dto: EntregarDto, archivo?: Express.Multer.File) {
    const actividad = await this.obtener(actividadId);
    const { alumno } = await this.validarAlumnoEnGrupoMateria(actividad.grupoMateriaId, user);

    const tarde = actividad.fechaEntrega !== null && new Date() > actividad.fechaEntrega;
    const previa = await this.entregas.findOne({ where: { actividadId, alumnoId: alumno.id } });

    const entrega = previa ?? this.entregas.create({ actividadId, alumnoId: alumno.id });
    entrega.comentarioAlumno = dto.comentario ?? entrega.comentarioAlumno;
    if (archivo) {
      entrega.archivoNombre = archivo.originalname;
      entrega.archivoRuta = `/uploads/${archivo.filename}`;
    }
    entrega.estatus = tarde ? 'TARDE' : 'ENTREGADA';
    entrega.fechaEntregado = new Date();
    return this.entregas.save(entrega);
  }

  async entregasDeActividad(actividadId: number, user: JwtUser) {
    const actividad = await this.obtener(actividadId);
    await this.validarPropiedad(actividad.grupoMateriaId, user);
    return this.entregas.find({ where: { actividadId }, order: { fechaEntregado: 'ASC' } });
  }

  async calificarEntrega(entregaId: number, dto: CalificarEntregaDto, user: JwtUser) {
    const entrega = await this.entregas.findOne({ where: { id: entregaId }, relations: { actividad: true } });
    if (!entrega) throw new NotFoundException('Entrega no encontrada');
    await this.validarPropiedad(entrega.actividad.grupoMateriaId, user);
    entrega.calificacion = dto.calificacion;
    entrega.comentarioDocente = dto.comentario ?? entrega.comentarioDocente;
    entrega.estatus = 'CALIFICADA';
    return this.entregas.save(entrega);
  }

  /** Tareas del alumno autenticado con el estado de su entrega. */
  async misTareas(user: JwtUser) {
    const alumno = await this.alumnos.obtenerPorUsuario(user.sub);
    const inscripciones = await this.inscripciones.find({
      where: { alumnoId: alumno.id, estatus: 'ACTIVA' },
    });
    if (inscripciones.length === 0) return [];

    const gms = await this.grupoMaterias.find({
      where: { grupoId: In(inscripciones.map((i) => i.grupoId)) },
    });
    if (gms.length === 0) return [];

    const actividades = await this.actividades.find({
      where: { grupoMateriaId: In(gms.map((g) => g.id)), activo: true },
      order: { fechaEntrega: 'ASC' },
    });
    if (actividades.length === 0) return [];

    const entregas = await this.entregas.find({
      where: { alumnoId: alumno.id, actividadId: In(actividades.map((a) => a.id)) },
    });
    const porActividad = new Map(entregas.map((e) => [e.actividadId, e]));
    return actividades.map((a) => ({ ...a, entrega: porActividad.get(a.id) ?? null }));
  }

  // ---- Materiales ----
  async subirMaterial(grupoMateriaId: number, titulo: string, archivo: Express.Multer.File, user: JwtUser) {
    await this.validarPropiedad(grupoMateriaId, user);
    return this.materiales.save(
      this.materiales.create({
        grupoMateriaId,
        titulo: titulo || archivo.originalname,
        archivoNombre: archivo.originalname,
        archivoRuta: `/uploads/${archivo.filename}`,
        mime: archivo.mimetype,
        tamanoKb: Math.round(archivo.size / 1024),
      }),
    );
  }

  async materialesDeGrupoMateria(grupoMateriaId: number, user: JwtUser) {
    if (user.roles.includes('ALUMNO')) await this.validarAlumnoEnGrupoMateria(grupoMateriaId, user);
    else await this.validarPropiedad(grupoMateriaId, user);
    return this.materiales.find({ where: { grupoMateriaId }, order: { createdAt: 'DESC' } });
  }
}
