import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
      return gm;
    }
    await this.scope.validarGestion(user, gm.grupo.plantelId);
    return gm;
  }

  /** Captura masiva por grupo-materia y parcial (upsert por alumno). */
  async capturar(dto: CapturaCalificacionesDto, user: JwtUser) {
    const gm = await this.validarGrupoMateria(dto.grupoMateriaId, user);

    const resultados: Calificacion[] = [];
    for (const item of dto.items) {
      const inscrito = await this.inscripciones.findOne({
        where: { alumnoId: item.alumnoId, grupoId: gm.grupoId, estatus: 'ACTIVA' },
      });
      if (!inscrito) throw new ForbiddenException('El alumno no está inscrito de forma activa en el grupo');
      const existente = await this.repo.findOne({
        where: { alumnoId: item.alumnoId, grupoMateriaId: dto.grupoMateriaId, parcial: dto.parcial },
      });
      const registro = existente ?? this.repo.create({
        alumnoId: item.alumnoId,
        grupoMateriaId: dto.grupoMateriaId,
        parcial: dto.parcial,
      });
      registro.calificacion = item.calificacion;
      registro.observaciones = item.observaciones ?? registro.observaciones ?? null;
      registro.capturadaPorId = user.sub;
      resultados.push(await this.repo.save(registro));
    }
    return { capturadas: resultados.length };
  }

  async porGrupoMateria(grupoMateriaId: number, user: JwtUser, parcial?: number) {
    await this.validarGrupoMateria(grupoMateriaId, user);
    return this.repo.find({
      where: parcial !== undefined ? { grupoMateriaId, parcial } : { grupoMateriaId },
      order: { alumnoId: 'ASC', parcial: 'ASC' },
    });
  }

  async porAlumno(alumnoId: number, user: JwtUser) {
    const alumno = await this.alumnos.obtener(alumnoId);
    if (
      user.roles.includes('MAESTRO') &&
      !user.roles.some((rol) => ['SUPERADMIN', 'ADMINISTRATIVO', 'FINANZAS'].includes(rol))
    ) {
      const docente = await this.docentes.obtenerPorUsuario(user.sub);
      const permitido = await this.inscripciones
        .createQueryBuilder('i')
        .innerJoin(GrupoMateria, 'gm', 'gm.grupo_id = i.grupo_id')
        .where('i.alumno_id = :alumnoId', { alumnoId })
        .andWhere('i.estatus = :estatus', { estatus: 'ACTIVA' })
        .andWhere('gm.docente_id = :docenteId', { docenteId: docente.id })
        .getCount();
      if (!permitido) throw new ForbiddenException('El alumno no pertenece a uno de tus grupos');
    } else if (!user.roles.includes('SUPERADMIN')) {
      await this.scope.validarGestion(user, alumno.plantelId);
    }
    return this.repo.find({ where: { alumnoId }, order: { grupoMateriaId: 'ASC', parcial: 'ASC' } });
  }

  async mias(user: JwtUser) {
    const alumno = await this.alumnos.obtenerPorUsuario(user.sub);
    return this.repo.find({ where: { alumnoId: alumno.id }, order: { grupoMateriaId: 'ASC', parcial: 'ASC' } });
  }
}
