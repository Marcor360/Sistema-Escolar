import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Calificacion } from '../entities/calificacion.entity';
import { GrupoMateria } from '../entities/grupo-materia.entity';
import { DocentesService } from '../docentes/docentes.service';
import { AlumnosService } from '../alumnos/alumnos.service';
import { JwtUser } from '../common/current-user.decorator';
import { CapturaCalificacionesDto } from './calificaciones.dto';

@Injectable()
export class CalificacionesService {
  constructor(
    @InjectRepository(Calificacion) private readonly repo: Repository<Calificacion>,
    @InjectRepository(GrupoMateria) private readonly grupoMaterias: Repository<GrupoMateria>,
    private readonly docentes: DocentesService,
    private readonly alumnos: AlumnosService,
  ) {}

  /** Captura masiva por grupo-materia y parcial (upsert por alumno). */
  async capturar(dto: CapturaCalificacionesDto, user: JwtUser) {
    const gm = await this.grupoMaterias.findOne({ where: { id: dto.grupoMateriaId } });
    if (!gm) throw new NotFoundException('Grupo-materia no encontrado');
    if (!user.roles.includes('SUPERADMIN') && !user.roles.includes('ADMINISTRATIVO')) {
      const docente = await this.docentes.obtenerPorUsuario(user.sub);
      if (gm.docenteId !== docente.id) {
        throw new ForbiddenException('La materia no está asignada a este docente');
      }
    }

    const resultados: Calificacion[] = [];
    for (const item of dto.items) {
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

  porGrupoMateria(grupoMateriaId: number, parcial?: number) {
    return this.repo.find({
      where: parcial !== undefined ? { grupoMateriaId, parcial } : { grupoMateriaId },
      order: { alumnoId: 'ASC', parcial: 'ASC' },
    });
  }

  porAlumno(alumnoId: number) {
    return this.repo.find({ where: { alumnoId }, order: { grupoMateriaId: 'ASC', parcial: 'ASC' } });
  }

  async mias(user: JwtUser) {
    const alumno = await this.alumnos.obtenerPorUsuario(user.sub);
    return this.porAlumno(alumno.id);
  }
}
