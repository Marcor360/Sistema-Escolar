import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Calificacion } from '../entities/calificacion.entity';
import { GrupoMateria } from '../entities/grupo-materia.entity';
import { DocentesService } from '../docentes/docentes.service';
import { AlumnosService } from '../alumnos/alumnos.service';
import { JwtUser } from '../common/current-user.decorator';
import { CapturaCalificacionesDto } from './calificaciones.dto';
import { Inscripcion } from '../entities/inscripcion.entity';
import { ScopeService } from '../planteles/scope.service';

@Injectable()
export class CalificacionesService {
  constructor(
    @InjectRepository(Calificacion) private readonly repo: Repository<Calificacion>,
    @InjectRepository(GrupoMateria) private readonly grupoMaterias: Repository<GrupoMateria>,
    @InjectRepository(Inscripcion) private readonly inscripciones: Repository<Inscripcion>,
    private readonly docentes: DocentesService,
    private readonly alumnos: AlumnosService,
    private readonly scope: ScopeService,
    private readonly dataSource: DataSource,
  ) {}

  private async validarGrupoMateria(grupoMateriaId: number, user: JwtUser) {
    const gm = await this.grupoMaterias.findOne({ where: { id: grupoMateriaId } });
    if (!gm) throw new NotFoundException('Grupo-materia no encontrado');
    if (user.roles.includes('SUPERADMIN')) return gm;
    if (
      user.roles.includes('MAESTRO') &&
      !user.roles.some((rol) => ['ADMINISTRATIVO', 'FINANZAS'].includes(rol))
    ) {
      const docente = await this.docentes.obtenerPorUsuario(user.sub);
      if (gm.docenteId !== docente.id) throw new ForbiddenException('La materia no está asignada a este docente');
      if (!gm.grupo.activo) throw new ForbiddenException('El grupo no está activo');
      return gm;
    }
    await this.scope.validarGestion(user, gm.grupo.plantelId);
    return gm;
  }

  /** Captura masiva por grupo-materia y parcial (upsert por alumno). */
  async capturar(dto: CapturaCalificacionesDto, user: JwtUser) {
    const gm = await this.validarGrupoMateria(dto.grupoMateriaId, user);

    const ids = [...new Set(dto.items.map((item) => item.alumnoId))];
    return this.dataSource.transaction(async (manager) => {
      const inscripciones = manager.getRepository(Inscripcion);
      const activos = await inscripciones.find({
        where: { alumnoId: In(ids), grupoId: gm.grupoId, estatus: 'ACTIVA' },
      });
      const activosIds = new Set(activos.map((i) => i.alumnoId));
      if (ids.some((id) => !activosIds.has(id))) {
        throw new ForbiddenException('Todos los alumnos deben estar inscritos de forma activa en el grupo');
      }
      const calificaciones = manager.getRepository(Calificacion);
      for (const item of dto.items) {
        const existente = await calificaciones.findOne({
          where: { alumnoId: item.alumnoId, grupoMateriaId: dto.grupoMateriaId, parcial: dto.parcial },
          lock: { mode: 'pessimistic_write' },
        });
        const registro = existente ?? calificaciones.create({
          alumnoId: item.alumnoId, grupoMateriaId: dto.grupoMateriaId, parcial: dto.parcial,
        });
        registro.calificacion = item.calificacion;
        registro.observaciones = item.observaciones ?? registro.observaciones ?? null;
        registro.capturadaPorId = user.sub;
        await calificaciones.save(registro);
      }
      return { capturadas: dto.items.length };
    });
  }

  async porGrupoMateria(grupoMateriaId: number, user: JwtUser, parcial?: number) {
    await this.validarGrupoMateria(grupoMateriaId, user);
    const registros = await this.repo.find({
      where: parcial !== undefined ? { grupoMateriaId, parcial } : { grupoMateriaId },
      order: { alumnoId: 'ASC', parcial: 'ASC' },
    });
    return registros.map((registro) => this.proyectar(registro));
  }

  async porAlumno(alumnoId: number, user: JwtUser) {
    const alumno = await this.alumnos.obtener(alumnoId);
    if (
      user.roles.includes('MAESTRO') &&
      !user.roles.some((rol) => ['SUPERADMIN', 'ADMINISTRATIVO', 'FINANZAS'].includes(rol))
    ) {
      const docente = await this.docentes.obtenerPorUsuario(user.sub);
      const asignaciones = await this.grupoMaterias.find({ where: { docenteId: docente.id } });
      const asignacionesActivas = asignaciones.filter((gm) => gm.grupo.activo);
      const grupoIds = [...new Set(asignacionesActivas.map((gm) => gm.grupoId))];
      if (grupoIds.length === 0) throw new ForbiddenException('El alumno no pertenece a uno de tus grupos');
      const inscripcionesActivas = await this.inscripciones.find({
        where: { alumnoId, grupoId: In(grupoIds), estatus: 'ACTIVA' },
      });
      const gruposActivos = new Set(inscripcionesActivas.map((i) => i.grupoId));
      const grupoMateriaIds = asignacionesActivas.filter((gm) => gruposActivos.has(gm.grupoId)).map((gm) => gm.id);
      if (grupoMateriaIds.length === 0) throw new ForbiddenException('El alumno no pertenece a uno de tus grupos');
      const registros = await this.repo.find({
        where: { alumnoId, grupoMateriaId: In(grupoMateriaIds) },
        order: { grupoMateriaId: 'ASC', parcial: 'ASC' },
      });
      return registros.map((registro) => this.proyectar(registro));
    } else if (!user.roles.includes('SUPERADMIN')) {
      await this.scope.validarGestion(user, alumno.plantelId);
    }
    const registros = await this.repo.find({ where: { alumnoId }, order: { grupoMateriaId: 'ASC', parcial: 'ASC' } });
    return registros.map((registro) => this.proyectar(registro));
  }

  async mias(user: JwtUser) {
    const alumno = await this.alumnos.obtenerPorUsuario(user.sub);
    const registros = await this.repo.find({ where: { alumnoId: alumno.id }, order: { grupoMateriaId: 'ASC', parcial: 'ASC' } });
    return registros.map((registro) => this.proyectar(registro));
  }

  private proyectar(registro: Calificacion) {
    return {
      id: registro.id,
      alumnoId: registro.alumnoId,
      grupoMateriaId: registro.grupoMateriaId,
      parcial: registro.parcial,
      calificacion: registro.calificacion,
      observaciones: registro.observaciones,
      grupoMateria: registro.grupoMateria ? {
        id: registro.grupoMateria.id,
        grupo: registro.grupoMateria.grupo ? {
          id: registro.grupoMateria.grupo.id,
          nombre: registro.grupoMateria.grupo.nombre,
        } : undefined,
        materia: registro.grupoMateria.materia ? {
          id: registro.grupoMateria.materia.id,
          clave: registro.grupoMateria.materia.clave,
          nombre: registro.grupoMateria.materia.nombre,
        } : undefined,
      } : undefined,
    };
  }
}
