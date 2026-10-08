import { esMaestroRestringido } from '../common/politica-acceso';
import { exigirGrupoConfigurable, grupoVigente, inscripcionVigente } from '../common/contexto-academico';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtUser } from '../common/current-user.decorator';
import { Alumno } from '../entities/alumno.entity';
import { Docente } from '../entities/docente.entity';
import { EventoCalendario } from '../entities/evento-calendario.entity';
import { Grupo } from '../entities/grupo.entity';
import { GrupoMateria } from '../entities/grupo-materia.entity';
import { Inscripcion } from '../entities/inscripcion.entity';
import { ScopeService } from '../planteles/scope.service';
import { EventoDto } from './calendario.dto';

@Injectable()
export class CalendarioService {
  constructor(
    @InjectRepository(EventoCalendario) private readonly eventos: Repository<EventoCalendario>,
    @InjectRepository(Grupo) private readonly grupos: Repository<Grupo>,
    @InjectRepository(GrupoMateria) private readonly grupoMaterias: Repository<GrupoMateria>,
    @InjectRepository(Inscripcion) private readonly inscripciones: Repository<Inscripcion>,
    @InjectRepository(Alumno) private readonly alumnos: Repository<Alumno>,
    @InjectRepository(Docente) private readonly docentes: Repository<Docente>,
    private readonly scope: ScopeService,
  ) {}

  async listar(user: JwtUser, desde?: string, hasta?: string, plantelId?: number) {
    if ((desde && !Number.isFinite(Date.parse(desde))) || (hasta && !Number.isFinite(Date.parse(hasta))) ||
        (desde && hasta && Date.parse(hasta) < Date.parse(desde))) throw new BadRequestException('Intervalo de fechas inválido');
    const qb = this.eventos.createQueryBuilder('e').leftJoinAndSelect('e.plantel', 'p');
    const inicioVentana = desde ? new Date(desde) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const finVentana = hasta ? new Date(hasta) : new Date(inicioVentana.getTime() + 90 * 24 * 60 * 60 * 1000);
    if (finVentana.getTime() - inicioVentana.getTime() > 366 * 24 * 60 * 60 * 1000) throw new BadRequestException('Consulta una ventana de hasta un año');
    qb.andWhere('(e.fecha_inicio >= :desde OR e.fecha_fin >= :desde)', { desde: inicioVentana });
    qb.andWhere('e.fecha_inicio <= :hasta', { hasta: finVentana });
    if (user.roles.includes('ALUMNO')) {
      const alumno = await this.alumnos.findOne({ where: { usuarioId: user.sub } });
      if (!alumno) throw new NotFoundException('El usuario no tiene expediente de alumno');
      const inscripciones = await this.inscripciones.find({ where: { ...inscripcionVigente, alumnoId: alumno.id } });
      const grupos = inscripciones.map((i) => i.grupoId);
      qb.andWhere(
        grupos.length
          ? '((e.plantel_id IS NULL AND e.grupo_id IS NULL) OR (e.plantel_id = :plantelAlumno AND e.grupo_id IS NULL) OR e.grupo_id IN (:...gruposAlumno))'
          : '((e.plantel_id IS NULL AND e.grupo_id IS NULL) OR (e.plantel_id = :plantelAlumno AND e.grupo_id IS NULL))',
        { plantelAlumno: alumno.plantelId, gruposAlumno: grupos },
      );
    } else {
      const maestroPuro = esMaestroRestringido(user);
      if (maestroPuro) {
        const docente = await this.docentes.findOne({ where: { usuarioId: user.sub } });
        const asignaciones = docente
          ? await this.grupoMaterias.find({ where: { docenteId: docente.id } })
          : [];
        const gruposActivos = asignaciones.filter((asignacion) => grupoVigente(asignacion.grupo));
        const grupoIds = [...new Set(gruposActivos.map((grupo) => grupo.grupoId))];
        const plantelesDocente = [...new Set(gruposActivos.map((grupo) => grupo.grupo.plantelId))];
        if (plantelId !== undefined && !plantelesDocente.includes(plantelId)) {
          throw new ForbiddenException('El plantel solicitado no contiene grupos activos asignados a este docente');
        }
        if (plantelId !== undefined) {
          const gruposDelPlantel = gruposActivos.filter((grupo) => grupo.grupo.plantelId === plantelId);
          const gruposFiltrados = [...new Set(gruposDelPlantel.map((grupo) => grupo.grupoId))];
          qb.andWhere('((e.plantel_id IS NULL AND e.grupo_id IS NULL) OR (e.plantel_id = :plantelId AND e.grupo_id IS NULL) OR e.grupo_id IN (:...grupoIds))', {
            plantelId, grupoIds: gruposFiltrados,
          });
        } else if (grupoIds.length > 0) {
          qb.andWhere('((e.plantel_id IS NULL AND e.grupo_id IS NULL) OR (e.plantel_id IN (:...planteles) AND e.grupo_id IS NULL) OR e.grupo_id IN (:...grupoIds))', {
            planteles: plantelesDocente, grupoIds,
          });
        } else {
          qb.andWhere('(e.plantel_id IS NULL AND e.grupo_id IS NULL)');
        }
      } else {
        const planteles = await this.scope.resolverFiltro(user, plantelId);
        if (planteles !== null) qb.andWhere('((e.plantel_id IS NULL AND e.grupo_id IS NULL) OR (e.grupo_id IS NULL AND e.plantel_id IN (:...planteles)) OR EXISTS (SELECT 1 FROM grupos g WHERE g.id = e.grupo_id AND g.plantel_id IN (:...planteles)))', { planteles });
        else if (plantelId) qb.andWhere('((e.plantel_id IS NULL AND e.grupo_id IS NULL) OR (e.grupo_id IS NULL AND e.plantel_id = :plantelId) OR EXISTS (SELECT 1 FROM grupos g WHERE g.id = e.grupo_id AND g.plantel_id = :plantelId))', { plantelId });
      }
    }
    return qb.orderBy('e.fecha_inicio', 'ASC').getMany();
  }

  async crear(dto: EventoDto, user: JwtUser) {
    const inicio = new Date(dto.fechaInicio).getTime();
    const fin = dto.fechaFin ? new Date(dto.fechaFin).getTime() : inicio;
    if (!Number.isFinite(inicio) || !Number.isFinite(fin) || fin < inicio) {
      throw new BadRequestException('Las fechas deben ser válidas y fechaFin no puede preceder a fechaInicio');
    }
    const superadmin = user.roles.includes('SUPERADMIN');
    const maestroPuro = user.roles.includes('MAESTRO') && !user.roles.includes('ADMINISTRATIVO') && !superadmin;
    let plantelId = dto.plantelId ?? null;
    if (maestroPuro) {
      if (!dto.grupoId) throw new ForbiddenException('El maestro debe seleccionar uno de sus grupos');
      const docente = await this.docentes.findOne({ where: { usuarioId: user.sub } });
      const gm = docente ? await this.grupoMaterias.findOne({ where: { grupoId: dto.grupoId, docenteId: docente.id } }) : null;
      if (!gm) throw new ForbiddenException('Solo puedes crear eventos para tus grupos');
      if (!gm.grupo.activo) throw new ForbiddenException('No puedes crear eventos para un grupo inactivo');
      plantelId = gm.grupo.plantelId;
    } else if (!superadmin) {
      if (!plantelId) throw new ForbiddenException('Solo SUPERADMIN puede crear eventos globales');
      await this.scope.validarGestion(user, plantelId);
    } else if (plantelId) {
      await this.scope.validarGestion(user, plantelId);
    }
    if (dto.grupoId) {
      const grupo = await this.grupos.findOne({ where: { id: dto.grupoId } });
      if (!grupo) throw new NotFoundException('Grupo no encontrado');
      exigirGrupoConfigurable(grupo);
      if (maestroPuro && !grupo.activo) throw new ForbiddenException('No puedes crear eventos para un grupo inactivo');
      if (plantelId && grupo.plantelId !== plantelId) throw new ForbiddenException('El grupo no pertenece al plantel indicado');
      plantelId = grupo.plantelId;
    }
    return this.eventos.save(this.eventos.create({
      titulo: dto.titulo,
      descripcion: dto.descripcion ?? null,
      tipo: dto.tipo ?? 'GENERAL',
      fechaInicio: new Date(dto.fechaInicio),
      fechaFin: dto.fechaFin ? new Date(dto.fechaFin) : null,
      plantelId,
      grupoId: dto.grupoId ?? null,
      creadoPorId: user.sub,
    }));
  }

  async eliminar(id: number, user: JwtUser) {
    const evento = await this.eventos.findOne({ where: { id } });
    if (!evento) throw new NotFoundException('Evento no encontrado');
    if (!user.roles.includes('SUPERADMIN')) {
      const maestroPuro = user.roles.includes('MAESTRO') && !user.roles.includes('ADMINISTRATIVO');
      if (maestroPuro) {
        if (evento.creadoPorId !== user.sub) throw new ForbiddenException('Solo puedes eliminar eventos que creaste');
      } else {
        if (!evento.plantelId) throw new ForbiddenException('Solo SUPERADMIN puede eliminar eventos globales');
        await this.scope.validarGestion(user, evento.plantelId);
      }
    }
    await this.eventos.delete(id);
    return { ok: true };
  }
}
