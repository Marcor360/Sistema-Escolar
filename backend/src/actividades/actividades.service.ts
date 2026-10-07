import { programarLimpieza } from '../archivos/archivo-limpieza.service';
import { basename } from 'path';
import { BitacoraAcademica } from '../entities/bitacora-academica.entity';
import { exigirGrupoVigente, inscripcionVigente } from '../common/contexto-academico';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { validarContenidoArchivo } from '../common/validar-archivo';
import { unlink } from 'fs/promises';
import { resolve } from 'path';
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
import { uploadsPath } from '../common/uploads-path';

async function limpiarArchivoFallido(archivo?: Express.Multer.File): Promise<void> {
  if (archivo?.path && resolve(archivo.path) === resolve(uploadsPath(), archivo.filename)) {
    await unlink(archivo.path).catch((): undefined => undefined);
  }
}

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
    private readonly dataSource: DataSource,
  ) {}

  /** El maestro solo opera sobre sus grupos-materia; ADMINISTRATIVO y SUPERADMIN, sobre todos. */
  private async validarPropiedad(grupoMateriaId: number, user: JwtUser): Promise<GrupoMateria> {
    const gm = await this.grupoMaterias.findOne({ where: { id: grupoMateriaId } });
    if (!gm) throw new NotFoundException('Grupo-materia no encontrado');
    if (!gm.grupo.activo) throw new ForbiddenException('El grupo no está activo');
    exigirGrupoVigente(gm.grupo);
    if (!gm.materia.activo) throw new ConflictException('La materia no está activa');
    if (user.roles.includes('SUPERADMIN')) return gm;
    if (user.roles.includes('ADMINISTRATIVO')) {
      await this.scope.validarGestion(user, gm.grupo.plantelId);
      return gm;
    }
    const docente = await this.docentes.obtenerPorUsuario(user.sub);
    if (gm.docenteId !== docente.id) {
      throw new ForbiddenException('La materia no está asignada a este docente');
    }
    if (!gm.grupo.activo) throw new ForbiddenException('El grupo no está activo');
    return gm;
  }

  private async validarAlumnoEnGrupoMateria(grupoMateriaId: number, user: JwtUser) {
    const alumno = await this.alumnos.obtenerPorUsuario(user.sub);
    const gm = await this.grupoMaterias.findOne({ where: { id: grupoMateriaId } });
    if (!gm) throw new NotFoundException('Grupo-materia no encontrado');
    if (!gm.grupo.activo) throw new ForbiddenException('El grupo no está activo');
    exigirGrupoVigente(gm.grupo);
    const inscripcion = await this.inscripciones.findOne({
      where: { ...inscripcionVigente, alumnoId: alumno.id, grupoId: gm.grupoId },
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
      fechaEntrega: dto.fechaEntrega === undefined ? actividad.fechaEntrega : dto.fechaEntrega ? new Date(dto.fechaEntrega) : null,
    });
    return this.actividades.save(actividad);
  }

  async desactivar(id: number, user: JwtUser) {
    const actividad = await this.obtener(id);
    await this.validarPropiedad(actividad.grupoMateriaId, user);
    return this.dataSource.transaction(async (manager) => {
      const actividades = manager.getRepository(Actividad);
      const actual = await actividades.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!actual) throw new NotFoundException('Actividad no encontrada');
      await actividades.update(id, { activo: false });
      return { ok: true };
    });
  }

  async obtener(id: number) {
    const actividad = await this.actividades.findOne({ where: { id } });
    if (!actividad) throw new NotFoundException('Actividad no encontrada');
    return actividad;
  }

  // ---- Entregas ----
  async entregar(actividadId: number, user: JwtUser, dto: EntregarDto, archivo?: Express.Multer.File) {
    const reemplazo: { anterior: string | null } = { anterior: null };
    try {
      if (archivo) await validarContenidoArchivo(archivo);
      const resultado = await this.dataSource.transaction(async (manager) => {
        const actividad = await manager.getRepository(Actividad).findOne({
          where: { id: actividadId }, lock: { mode: 'pessimistic_write' },
        });
        if (!actividad) throw new NotFoundException('Actividad no encontrada');
        if (!actividad.activo) throw new ConflictException('La actividad ya no admite entregas');
        const { alumno } = await this.validarAlumnoEnGrupoMateria(actividad.grupoMateriaId, user);
        const entregas = manager.getRepository(Entrega);
        const previa = await entregas.findOne({
          where: { actividadId, alumnoId: alumno.id }, lock: { mode: 'pessimistic_write' },
        });
        const entrega = previa ?? entregas.create({ actividadId, alumnoId: alumno.id });
        if (previa?.estatus === 'CALIFICADA') throw new ConflictException('Una entrega calificada no admite reentrega');
        entrega.comentarioAlumno = dto.comentario ?? entrega.comentarioAlumno ?? null;
        if (archivo) {
          reemplazo.anterior = previa?.archivoRuta ?? null;
          if (reemplazo.anterior) await programarLimpieza(manager, reemplazo.anterior);
          entrega.archivoNombre = archivo.originalname;
          entrega.archivoRuta = `/uploads/${archivo.filename}`;
        }
        const ahora = new Date();
        entrega.estatus = actividad.fechaEntrega !== null && ahora > actividad.fechaEntrega ? 'TARDE' : 'ENTREGADA';
        entrega.fechaEntregado = ahora;
        return entregas.save(entrega);
      });
      if (reemplazo.anterior && archivo) {
        const nombre = reemplazo.anterior.replace(/^\/uploads\//, '');
        if (nombre && !nombre.includes('/') && !nombre.includes('\\')) await unlink(resolve(uploadsPath(), nombre)).catch((): undefined => undefined);
      }
      return resultado;
    } catch (error) {
      await limpiarArchivoFallido(archivo);
      throw error;
    }
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
    return this.dataSource.transaction(async (manager) => {
      const entregas = manager.getRepository(Entrega);
      const actual = await entregas.findOne({ where: { id: entregaId }, lock: { mode: 'pessimistic_write' } });
      if (!actual) throw new NotFoundException('Entrega no encontrada');
      actual.calificacion = dto.calificacion;
      actual.comentarioDocente = dto.comentario ?? actual.comentarioDocente;
      actual.estatus = 'CALIFICADA';
      return entregas.save(actual);
    });
  }

  /** Tareas del alumno autenticado con el estado de su entrega. */
  async misTareas(user: JwtUser) {
    const alumno = await this.alumnos.obtenerPorUsuario(user.sub);
    const inscripciones = await this.inscripciones.find({
      where: { ...inscripcionVigente, alumnoId: alumno.id },
    });
    if (inscripciones.length === 0) return [];

    const gms = await this.grupoMaterias.find({
      where: { grupoId: In(inscripciones.map((i) => i.grupoId)) },
    });
    const gruposActivos = gms.filter((gm) => gm.grupo.activo);
    if (gruposActivos.length === 0) return [];

    const actividades = await this.actividades.find({
      where: { grupoMateriaId: In(gruposActivos.map((g) => g.id)), activo: true },
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
  async subirMaterial(grupoMateriaId: number, titulo: string, archivo: Express.Multer.File | undefined, user: JwtUser) {
    try {
      if (!archivo) throw new BadRequestException('Selecciona un archivo');
      await validarContenidoArchivo(archivo);
      await this.validarPropiedad(grupoMateriaId, user);
      return await this.materiales.save(
        this.materiales.create({
          grupoMateriaId,
          titulo: titulo || archivo.originalname,
          archivoNombre: archivo.originalname,
          archivoRuta: `/uploads/${archivo.filename}`,
          mime: archivo.mimetype,
          tamanoKb: Math.round(archivo.size / 1024),
        }),
      );
    } catch (error) {
      await limpiarArchivoFallido(archivo);
      throw error;
    }
  }

  async actualizarMaterial(id: number, titulo: string, user: JwtUser) {
    const material = await this.materiales.findOneBy({ id });
    if (!material) throw new NotFoundException('Material no encontrado');
    await this.validarPropiedad(material.grupoMateriaId, user);
    if (!titulo.trim() || titulo.trim().length > 150) throw new BadRequestException('Título entre 1 y 150 caracteres');
    await this.materiales.update(id, { titulo: titulo.trim() });
    return { ok: true };
  }

  async eliminarMaterial(id: number, user: JwtUser) {
    const material = await this.materiales.findOneBy({ id });
    if (!material) throw new NotFoundException('Material no encontrado');
    const gm = await this.validarPropiedad(material.grupoMateriaId, user);
    await this.dataSource.transaction(async (manager) => {
      const actual = await manager.getRepository(Material).findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!actual) throw new NotFoundException('Material ya retirado');
      await programarLimpieza(manager, actual.archivoRuta);
      await manager.getRepository(Material).delete(id);
      await manager.getRepository(BitacoraAcademica).insert({ usuarioId: user.sub, plantelId: gm.grupo.plantelId, accion: 'MATERIAL_RETIRADO', entidadId: id, detalle: `grupoMateriaId=${gm.id}`, fecha: new Date() });
    });
    if (/^\/uploads\/[^/\\]+$/.test(material.archivoRuta)) await unlink(resolve(uploadsPath(), basename(material.archivoRuta))).catch(() => undefined);
    return { ok: true };
  }

  async materialesDeGrupoMateria(grupoMateriaId: number, user: JwtUser) {
    if (user.roles.includes('ALUMNO')) await this.validarAlumnoEnGrupoMateria(grupoMateriaId, user);
    else await this.validarPropiedad(grupoMateriaId, user);
    return this.materiales.find({ where: { grupoMateriaId }, order: { createdAt: 'DESC' } });
  }
}
