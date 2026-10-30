import { randomUUID } from 'crypto';
import { MarcadorCalendario } from '../entities/marcador-calendario.entity';
import { Plantel } from '../entities/plantel.entity';
import { MARCADORES_INICIALES } from './marcadores';
import { GuardarMarcadorDto } from './calendario.dto';
import { EntityManager } from 'typeorm';
import { CalendarioHistorial } from '../entities/calendario-historial.entity';
import { Notificacion } from '../entities/notificacion.entity';
import { ImportarCalendarioDto } from './calendario.dto';
import { leerIcs } from './calendario-ics';
import { promises as fs } from 'fs';
import { join } from 'path';
import { BitacoraAcademica, CicloEscolar, NivelAcademico, Usuario } from '../entities';
import { In } from 'typeorm';
import { uploadsPath } from '../common/uploads-path';
import { validarContenidoArchivo } from '../common/validar-archivo';
import { programarLimpieza } from '../archivos/archivo-limpieza.service';
import { createHash } from 'crypto';
import { esMaestroRestringido } from '../common/politica-acceso';
import { exigirGrupoConfigurable, grupoVigente, inscripcionVigente } from '../common/contexto-academico';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
import { EventoDto, EditarEventoDto, ConsultarEventosDto } from './calendario.dto';

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

  async marcadores(user: JwtUser, plantelId?: number) {
    if (!plantelId) return MARCADORES_INICIALES;
    const opciones = await this.opciones(user);
    if (!user.roles.includes('SUPERADMIN') && !opciones.niveles.some((n) => n.plantelId === plantelId))
      throw new ForbiddenException('Plantel fuera del calendario autorizado');
    const filas = await this.eventos.manager.getRepository(MarcadorCalendario).find({ where: { plantelId }, order: { id: 'ASC' } });
    return [...MARCADORES_INICIALES.map((base) => filas.find((f) => f.clave === base.clave) ?? base),
      ...filas.filter((f) => !MARCADORES_INICIALES.some((b) => b.clave === f.clave))];
  }
  async guardarMarcador(dto: GuardarMarcadorDto, user: JwtUser) {
    if (!user.roles.some((r) => ['SUPERADMIN', 'ADMINISTRATIVO', 'FINANZAS'].includes(r)))
      throw new ForbiddenException('No puedes configurar marcadores');
    await this.scope.validarGestion(user, dto.plantelId);
    const clave = dto.clave ?? randomUUID();
    return this.eventos.manager.transaction(async (m) => {
      const plantel = await m.getRepository(Plantel).findOne({ where: { id: dto.plantelId, activo: true }, lock: { mode: 'pessimistic_write' } });
      if (!plantel) throw new BadRequestException('Plantel no disponible');
      const repo = m.getRepository(MarcadorCalendario);
      const previo = await repo.findOneBy({ plantelId: dto.plantelId, clave });
      if (previo && dto.revision !== previo.revision) throw new ConflictException('El marcador cambió; recarga antes de guardar');
      if (!previo && dto.revision && dto.revision > 0) throw new ConflictException('El marcador ya no está disponible');
      if (!previo && await repo.countBy({ plantelId: dto.plantelId }) >= 100)
        throw new BadRequestException('El plantel admite hasta 100 marcadores personalizados');
      const guardado = await repo.save({ ...previo, plantelId: dto.plantelId, clave, nombre: dto.nombre, color: dto.color.toUpperCase(), forma: dto.forma, revision: (previo?.revision ?? 0) + 1 });
      await m.getRepository(BitacoraAcademica).insert({ usuarioId: user.sub, plantelId: dto.plantelId, accion: 'CALENDARIO_MARCADOR', entidadId: guardado.id, fecha: new Date(), detalle: JSON.stringify({ antes: previo, despues: guardado }) });
      return guardado;
    });
  }
  private async presentar(eventos: EventoCalendario[]) {
    const planteles = [...new Set(eventos.filter((e) => e.marcadorClave && e.plantelId).map((e) => e.plantelId!))];
    const configurados = planteles.length ? await this.eventos.manager.getRepository(MarcadorCalendario).find({ where: { plantelId: In(planteles) }, loadEagerRelations: false }) : [];
    return eventos.map((e) => ({ ...e, revision: this.revision(e), marcador: e.marcadorClave ?
      configurados.find((m) => m.plantelId === e.plantelId && m.clave === e.marcadorClave) ?? MARCADORES_INICIALES.find((m) => m.clave === e.marcadorClave) ?? null : null }));
  }

  private async consulta(user: JwtUser, desde?: string, hasta?: string, plantelId?: number) {
    if (
      (desde && !Number.isFinite(Date.parse(desde))) ||
      (hasta && !Number.isFinite(Date.parse(hasta))) ||
      (desde && hasta && Date.parse(hasta) < Date.parse(desde))
    )
      throw new BadRequestException('Intervalo de fechas inválido');
    const qb = this.eventos.createQueryBuilder('e').leftJoinAndSelect('e.plantel', 'p');
    const inicioVentana = desde ? new Date(desde) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const finVentana = hasta ? new Date(hasta) : new Date(inicioVentana.getTime() + 90 * 24 * 60 * 60 * 1000);
    if (finVentana < inicioVentana) throw new BadRequestException('El fin de la consulta no puede preceder al inicio');
    if (finVentana.getTime() - inicioVentana.getTime() > 366 * 24 * 60 * 60 * 1000)
      throw new BadRequestException('Consulta una ventana de hasta un año');
    qb.andWhere('(e.fecha_inicio >= :desde OR e.fecha_fin >= :desde)', { desde: inicioVentana });
    qb.andWhere('e.fecha_inicio <= :hasta', { hasta: finVentana });
    if (!user.roles.some((r) => ['SUPERADMIN', 'ADMINISTRATIVO', 'FINANZAS'].includes(r)))
      qb.andWhere('e.audiencia = :audiencia', { audiencia: 'ACADEMICA' });
    if (user.roles.includes('ALUMNO')) {
      const alumno = await this.alumnos.findOne({ where: { usuarioId: user.sub } });
      if (!alumno) throw new NotFoundException('El usuario no tiene expediente de alumno');
      const inscripciones = await this.inscripciones.find({ where: { ...inscripcionVigente, alumnoId: alumno.id } });
      const grupos = inscripciones.map((i) => i.grupoId);
      const niveles = [...new Set(inscripciones.map((i) => i.grupo?.nivelId).filter((n): n is number => !!n))];
      qb.andWhere(niveles.length ? '(e.nivel_id IS NULL OR e.nivel_id IN (:...niveles))' : 'e.nivel_id IS NULL', {
        niveles,
      });
      qb.andWhere(
        grupos.length
          ? '((e.plantel_id IS NULL AND e.grupo_id IS NULL) OR (e.plantel_id = :plantelAlumno AND e.grupo_id IS NULL) OR e.grupo_id IN (:...gruposAlumno))'
          : '((e.plantel_id IS NULL AND e.grupo_id IS NULL) OR (e.plantel_id = :plantelAlumno AND e.grupo_id IS NULL))',
        { plantelAlumno: alumno.plantelId, gruposAlumno: grupos },
      );
    } else {
      const maestroPuro = esMaestroRestringido(user) && !user.roles.includes('FINANZAS');
      if (maestroPuro) {
        const docente = await this.docentes.findOne({ where: { usuarioId: user.sub } });
        const asignaciones = docente ? await this.grupoMaterias.find({ where: { docenteId: docente.id } }) : [];
        const gruposActivos = asignaciones.filter((asignacion) => grupoVigente(asignacion.grupo));
        const grupoIds = [...new Set(gruposActivos.map((grupo) => grupo.grupoId))];
        const niveles = [...new Set(gruposActivos.map((g) => g.grupo.nivelId).filter((n): n is number => !!n))];
        qb.andWhere(niveles.length ? '(e.nivel_id IS NULL OR e.nivel_id IN (:...niveles))' : 'e.nivel_id IS NULL', {
          niveles,
        });
        const plantelesDocente = [...new Set(gruposActivos.map((grupo) => grupo.grupo.plantelId))];
        if (plantelId !== undefined && !plantelesDocente.includes(plantelId)) {
          throw new ForbiddenException('El plantel solicitado no contiene grupos activos asignados a este docente');
        }
        if (plantelId !== undefined) {
          const gruposDelPlantel = gruposActivos.filter((grupo) => grupo.grupo.plantelId === plantelId);
          const gruposFiltrados = [...new Set(gruposDelPlantel.map((grupo) => grupo.grupoId))];
          qb.andWhere(
            '((e.plantel_id IS NULL AND e.grupo_id IS NULL) OR (e.plantel_id = :plantelId AND e.grupo_id IS NULL) OR e.grupo_id IN (:...grupoIds))',
            {
              plantelId,
              grupoIds: gruposFiltrados,
            },
          );
        } else if (grupoIds.length > 0) {
          qb.andWhere(
            '((e.plantel_id IS NULL AND e.grupo_id IS NULL) OR (e.plantel_id IN (:...planteles) AND e.grupo_id IS NULL) OR e.grupo_id IN (:...grupoIds))',
            {
              planteles: plantelesDocente,
              grupoIds,
            },
          );
        } else {
          qb.andWhere('(e.plantel_id IS NULL AND e.grupo_id IS NULL)');
        }
      } else {
        const planteles = await this.scope.resolverFiltro(user, plantelId);
        if (planteles !== null)
          qb.andWhere(
            '((e.plantel_id IS NULL AND e.grupo_id IS NULL) OR (e.grupo_id IS NULL AND e.plantel_id IN (:...planteles)) OR EXISTS (SELECT 1 FROM grupos g WHERE g.id = e.grupo_id AND g.plantel_id IN (:...planteles)))',
            { planteles },
          );
        else if (plantelId)
          qb.andWhere(
            '((e.plantel_id IS NULL AND e.grupo_id IS NULL) OR (e.grupo_id IS NULL AND e.plantel_id = :plantelId) OR EXISTS (SELECT 1 FROM grupos g WHERE g.id = e.grupo_id AND g.plantel_id = :plantelId))',
            { plantelId },
          );
      }
    }
    return qb.orderBy('e.fechaInicio', 'ASC');
  }
  async listar(user: JwtUser, desde?: string, hasta?: string, plantelId?: number, cicloId?: number, nivelId?: number, ambito?: 'CONSOLIDADO' | 'GLOBAL') {
    const qb = await this.consulta(user, desde, hasta, plantelId);
    if (ambito === 'GLOBAL') qb.andWhere('(e.plantel_id IS NULL AND e.grupo_id IS NULL)');
    if (cicloId) qb.andWhere('(e.ciclo_id = :cicloId OR e.ciclo_id IS NULL)', { cicloId });
    if (nivelId) qb.andWhere('(e.nivel_id = :nivelId OR e.nivel_id IS NULL)', { nivelId });
    const eventos = await qb.getMany();
    return this.presentar(eventos);
  }
  async consultar(q: ConsultarEventosDto, user: JwtUser) {
    const qb = await this.consulta(user, q.desde, q.hasta, q.plantelId);
    if (q.ambito === 'GLOBAL') qb.andWhere('(e.plantel_id IS NULL AND e.grupo_id IS NULL)');
    if (q.cicloId) qb.andWhere('(e.ciclo_id = :cicloId OR e.ciclo_id IS NULL)', { cicloId: q.cicloId });
    if (q.nivelId) qb.andWhere('(e.nivel_id = :nivelId OR e.nivel_id IS NULL)', { nivelId: q.nivelId });
    if (q.buscar?.trim()) {
      const termino =
        '%' +
        q.buscar
          .trim()
          .toLowerCase()
          .replace(/[!%_[]/g, (c) => '!' + c) +
        '%';
      qb.andWhere("LOWER(e.titulo) LIKE :termino ESCAPE '!'", { termino });
    }
    const [eventos, total] = await qb
      .addOrderBy('e.id', 'ASC')
      .skip((q.pagina - 1) * q.porPagina)
      .take(q.porPagina)
      .getManyAndCount();
    return {
      datos: await this.presentar(eventos),
      total,
      pagina: q.pagina,
      porPagina: q.porPagina,
    };
  }
  async paraEditar(id: number, user: JwtUser) {
    const evento = await this.eventos.findOne({ where: { id }, relations: { plantel: true } });
    if (!evento) throw new NotFoundException('Evento no encontrado');
    await this.autorizarOrigen(evento, user);
    return { ...evento, revision: this.revision(evento) };
  }

  async crear(dto: EventoDto, user: JwtUser) {
    const datos = await this.preparar(dto, user);
    return this.eventos.manager.transaction(async (m) => {
      const e = await m.getRepository(EventoCalendario).save(datos);
      await this.registrarCambio(m, e, user, 'CREAR', dto.avisar);
      return e;
    });
  }

  private async preparar(dto: EventoDto, user: JwtUser) {
    const inicio = new Date(dto.fechaInicio).getTime();
    const fin = dto.fechaFin ? new Date(dto.fechaFin).getTime() : inicio;
    if (!Number.isFinite(inicio) || !Number.isFinite(fin) || fin < inicio) {
      throw new BadRequestException('Las fechas deben ser válidas y fechaFin no puede preceder a fechaInicio');
    }
    const superadmin = user.roles.includes('SUPERADMIN');
    const maestroPuro = esMaestroRestringido(user) && !user.roles.includes('FINANZAS');
    let plantelId = dto.plantelId ?? null;
    if (maestroPuro) {
      if (!dto.grupoId) throw new ForbiddenException('El maestro debe seleccionar uno de sus grupos');
      const docente = await this.docentes.findOne({ where: { usuarioId: user.sub } });
      const gm = docente
        ? await this.grupoMaterias.findOne({ where: { grupoId: dto.grupoId, docenteId: docente.id } })
        : null;
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
      if (plantelId && grupo.plantelId !== plantelId)
        throw new ForbiddenException('El grupo no pertenece al plantel indicado');
      plantelId = grupo.plantelId;
    }
    let nivelId = dto.nivelId ?? null;
    if (dto.grupoId) {
      const grupo = await this.grupos.findOne({ where: { id: dto.grupoId } });
      if (nivelId && grupo?.nivelId !== nivelId) throw new BadRequestException('El nivel no coincide con el grupo');
      nivelId = grupo?.nivelId ?? nivelId;
    }
    if (nivelId) {
      const nivel = await this.eventos.manager.getRepository(NivelAcademico).findOneBy({ id: nivelId, activo: true });
      if (!nivel || nivel.plantelId !== plantelId) throw new BadRequestException('El nivel no pertenece al plantel');
    }
    if (dto.cicloId) {
      const ciclo = await this.eventos.manager.getRepository(CicloEscolar).findOneBy({ id: dto.cicloId });
      if (!ciclo) throw new BadRequestException('Ciclo no encontrado');
      const desde = new Date(ciclo.fechaInicio + 'T00:00:00-06:00').getTime();
      const hasta = new Date(ciclo.fechaFin + 'T23:59:59-06:00').getTime();
      if (inicio < desde || fin > hasta) throw new BadRequestException('El evento debe quedar dentro del ciclo');
    }
    if (maestroPuro && dto.audiencia && dto.audiencia !== 'ACADEMICA')
      throw new ForbiddenException('El maestro solo publica información académica');
    if (dto.marcadorClave) {
      if (!plantelId) throw new BadRequestException('El marcador requiere un plantel');
      if (!MARCADORES_INICIALES.some((m) => m.clave === dto.marcadorClave) &&
        !await this.eventos.manager.getRepository(MarcadorCalendario).existsBy({ plantelId, clave: dto.marcadorClave }))
        throw new BadRequestException('El marcador no pertenece al plantel');
    }
    return {
      marcadorClave: dto.marcadorClave || null,
      cicloId: dto.cicloId ?? null,
      nivelId,
      audiencia: dto.audiencia ?? 'ACADEMICA',
      titulo: dto.titulo,
      descripcion: dto.descripcion ?? null,
      tipo: dto.tipo ?? 'GENERAL',
      fechaInicio: new Date(dto.fechaInicio),
      fechaFin: dto.fechaFin ? new Date(dto.fechaFin) : null,
      plantelId,
      grupoId: dto.grupoId ?? null,
      creadoPorId: user.sub,
    };
  }

  private revision(e: EventoCalendario) {
    return createHash('sha256')
      .update(
        JSON.stringify([
          e.id,
          e.titulo,
          e.descripcion,
          e.tipo,
          e.fechaInicio,
          e.fechaFin,
          e.plantelId,
          e.grupoId,
          e.creadoPorId,
          e.cicloId,
          e.nivelId,
          e.audiencia,
          e.imagenNombre,
          ...(e.marcadorClave ? [e.marcadorClave] : []),
        ]),
      )
      .digest('hex');
  }

  private async autorizarOrigen(evento: EventoCalendario, user: JwtUser) {
    if (user.roles.includes('SUPERADMIN')) return;
    if (esMaestroRestringido(user) && !user.roles.includes('FINANZAS')) {
      if (evento.creadoPorId !== user.sub || !evento.grupoId)
        throw new ForbiddenException('Solo puedes modificar eventos propios de tus grupos actuales');
      const docente = await this.docentes.findOne({ where: { usuarioId: user.sub } });
      const gm = docente
        ? await this.grupoMaterias.findOne({ where: { grupoId: evento.grupoId, docenteId: docente.id } })
        : null;
      if (!gm || !grupoVigente(gm.grupo)) throw new ForbiddenException('El grupo ya no está asignado o vigente');
    } else {
      if (!evento.plantelId) throw new ForbiddenException('Solo SUPERADMIN puede modificar eventos globales');
      await this.scope.validarGestion(user, evento.plantelId);
    }
  }

  async editar(id: number, dto: EditarEventoDto, user: JwtUser) {
    if (
      ![
        'marcadorClave',
        'titulo',
        'descripcion',
        'tipo',
        'fechaInicio',
        'fechaFin',
        'plantelId',
        'grupoId',
        'nivelId',
        'cicloId',
        'audiencia',
      ].some((campo) => dto[campo as keyof EditarEventoDto] !== undefined)
    )
      throw new BadRequestException('No se indicaron cambios');
    if (dto.titulo !== undefined) {
      if (typeof dto.titulo !== 'string' || !dto.titulo.trim())
        throw new BadRequestException('El título es obligatorio');
      dto = { ...dto, titulo: dto.titulo.trim() };
    }
    return this.eventos.manager.transaction(async (manager) => {
      const repo = manager.getRepository(EventoCalendario);
      const evento = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!evento) throw new NotFoundException('Evento no encontrado');
      await this.autorizarOrigen(evento, user);
      if (dto.revision !== this.revision(evento))
        throw new ConflictException('El evento cambió; recarga antes de editar');
      const destino = await this.preparar(
        {
          marcadorClave: dto.marcadorClave === undefined ? evento.marcadorClave ?? undefined : dto.marcadorClave,
          cicloId: dto.cicloId ?? evento.cicloId ?? undefined,
          nivelId: dto.nivelId ?? evento.nivelId ?? undefined,
          audiencia: dto.audiencia ?? evento.audiencia,
          titulo: dto.titulo ?? evento.titulo,
          descripcion: dto.descripcion === undefined ? (evento.descripcion ?? undefined) : dto.descripcion,
          tipo: dto.tipo ?? evento.tipo,
          fechaInicio: dto.fechaInicio ?? evento.fechaInicio.toISOString(),
          fechaFin: dto.fechaFin === undefined ? evento.fechaFin?.toISOString() : dto.fechaFin,
          plantelId: dto.plantelId === undefined ? (evento.plantelId ?? undefined) : dto.plantelId,
          grupoId: dto.grupoId === undefined ? (evento.grupoId ?? undefined) : dto.grupoId,
        },
        user,
      );
      Object.assign(evento, destino, { creadoPorId: evento.creadoPorId });
      const actualizado = await repo.save(evento);
      await this.registrarCambio(manager, actualizado, user, 'EDITAR', dto.avisar);
      return { ...actualizado, revision: this.revision(actualizado) };
    });
  }

  async eliminar(id: number, user: JwtUser) {
    return this.eventos.manager.transaction(async manager => {
      const repo=manager.getRepository(EventoCalendario);
      const evento=await repo.findOne({where:{id},lock:{mode:'pessimistic_write'}});
      if(!evento)throw new NotFoundException('Evento no encontrado');
      await this.autorizarOrigen(evento,user);
      await this.registrarCambio(manager,evento,user,'ELIMINAR');
      await repo.delete(id);
      if(evento.imagenNombre)await programarLimpieza(manager,'/uploads/'+evento.imagenNombre);
      return {ok:true};
    });
  }
  async opciones(user: JwtUser) {
    let planteles: number[] | null;
    let niveles: number[] | null = null;
    if (user.roles.includes('ALUMNO')) {
      const alumno = await this.alumnos.findOne({ where: { usuarioId: user.sub } });
      if (!alumno) throw new ForbiddenException();
      planteles = [alumno.plantelId];
      const inscripciones = await this.inscripciones.find({ where: { ...inscripcionVigente, alumnoId: alumno.id } });
      niveles = inscripciones.map((i) => i.grupo.nivelId).filter((n): n is number => !!n);
    } else if (esMaestroRestringido(user) && !user.roles.includes('FINANZAS')) {
      const docente = await this.docentes.findOne({ where: { usuarioId: user.sub } });
      const clases = docente ? await this.grupoMaterias.find({ where: { docenteId: docente.id } }) : [];
      const grupos = clases.filter((c) => grupoVigente(c.grupo));
      planteles = grupos.map((c) => c.grupo.plantelId);
      niveles = grupos.map((c) => c.grupo.nivelId).filter((n): n is number => !!n);
    } else planteles = await this.scope.resolverFiltro(user);
    const nivelesVisibles =
      niveles?.length === 0 || planteles?.length === 0
        ? []
        : await this.eventos.manager.getRepository(NivelAcademico).find({
            relations: { plantel: true },
            where: {
              activo: true,
              ...(planteles ? { plantelId: In(planteles) } : {}),
              ...(niveles ? { id: In(niveles) } : {}),
            },
            order: { nombre: 'ASC' },
          });
    return {
      ciclos: await this.eventos.manager.getRepository(CicloEscolar).find({ order: { fechaInicio: 'DESC' } }),
      niveles: nivelesVisibles.map((n) => ({
        id: n.id,
        nombre: n.nombre,
        plantelId: n.plantelId,
        plantel: { nombre: n.plantel?.nombre },
      })),
    };
  }
  async crearImagen(dto: EventoDto, file: Express.Multer.File, user: JwtUser) {
    try {
      if (!dto.cicloId || !dto.nivelId) throw new BadRequestException('Selecciona ciclo y nivel académico');
      await validarContenidoArchivo(file);
      const datos = { ...(await this.preparar(dto, user)), imagenNombre: file.filename };
      return await this.eventos.manager.transaction(async (m) => {
        const e = await m.getRepository(EventoCalendario).save(datos);
        await this.registrarCambio(m, e, user, 'CREAR_IMAGEN', dto.avisar);
        return e;
      });
    } catch (e) {
      await fs.unlink(file.path).catch(() => undefined);
      throw e;
    }
  }
  private async registrarCambio(
    manager: EntityManager,
    e: EventoCalendario,
    user: JwtUser,
    accion: string,
    avisar = false,
  ) {
    await manager
      .getRepository(CalendarioHistorial)
      .save({
        eventoId: e.id,
        usuarioId: user.sub,
        plantelId: e.plantelId,
        accion,
        alcance: JSON.stringify({
          plantelId: e.plantelId,
          grupoId: e.grupoId,
          cicloId: e.cicloId,
          nivelId: e.nivelId,
          audiencia: e.audiencia,
        }),
      });
    if (avisar && e.audiencia === 'ACADEMICA') {
      const qb = manager
        .getRepository(Inscripcion)
        .createQueryBuilder('i')
        .innerJoin('i.grupo', 'g')
        .innerJoin('i.alumno', 'a')
        .innerJoin('a.usuario', 'u')
        .innerJoin('g.ciclo', 'c')
        .where('i.estatus=:estatus AND g.activo=:activo AND c.activo=:activo AND u.activo=:activo', {
          estatus: 'ACTIVA',
          activo: true,
        });
      if (e.plantelId) qb.andWhere('g.plantel_id=:plantel', { plantel: e.plantelId });
      if (e.nivelId) qb.andWhere('g.nivel_id=:nivel', { nivel: e.nivelId });
      if (e.grupoId) qb.andWhere('g.id=:grupo', { grupo: e.grupoId });
      const ids = await qb.select('a.usuario_id', 'usuarioId').distinct(true).getRawMany<{ usuarioId: number }>();
      for (const { usuarioId } of ids)
        await manager
          .getRepository(Notificacion)
          .save({
            usuarioId,
            titulo: 'Cambio en el calendario escolar',
            mensaje:
              'Hay una actualización del calendario. Consulta la vista de tu nivel para ver la información vigente.',
            tipo: 'ACADEMICA',
            pushPendiente: true,
          });
    }
  }
  async historial(id: number, user: JwtUser) {
    await this.paraEditar(id, user);
    const filas=await this.eventos.manager.getRepository(CalendarioHistorial).find({where:{eventoId:id},order:{id:'DESC'},take:100});
    if(!filas.length)return [];
    const autores=await this.eventos.manager.getRepository(Usuario).find({where:{id:In([...new Set(filas.map(f=>f.usuarioId))])},select:{id:true,nombre:true,apellidoPaterno:true}});
    return filas.map(f=>({...f,autor:autores.find(a=>a.id===f.usuarioId)?.nombreCompleto??'Cuenta no disponible'}));
  }
  async importarIcs(dto: ImportarCalendarioDto, user: JwtUser, confirmar = false) {
    const leidos = leerIcs(dto.contenido);
    const eventos: Array<Awaited<ReturnType<typeof this.preparar>> & { claveImportacion: string }> = [];
    for (const e of leidos) {
      const datos = await this.preparar({ ...dto, ...e, tipo: 'GENERAL' }, user);
      const clave = createHash('sha256')
        .update(JSON.stringify([dto.plantelId, dto.nivelId, dto.cicloId, e.uid]))
        .digest('hex');
      eventos.push({ ...datos, claveImportacion: clave });
    }
    if (!confirmar) return eventos.map((e) => ({ titulo: e.titulo, fechaInicio: e.fechaInicio, fechaFin: e.fechaFin }));
    return this.eventos.manager.transaction(async (m) => {
      const repo = m.getRepository(EventoCalendario);
      let creados = 0;
      for (const datos of eventos) {
        if (await repo.existsBy({ claveImportacion: datos.claveImportacion })) continue;
        const e = await repo.save(datos);
        await this.registrarCambio(m, e, user, 'IMPORTAR_ICS');
        creados++;
      }
      return { creados };
    });
  }
  async reemplazarImagen(id: number, dto: EditarEventoDto, file: Express.Multer.File, user: JwtUser) {
    try {
      await validarContenidoArchivo(file);
      return await this.eventos.manager.transaction(async (manager) => {
        const repo = manager.getRepository(EventoCalendario);
        const evento = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
        if (!evento) throw new NotFoundException();
        await this.autorizarOrigen(evento, user);
        if (dto.revision !== this.revision(evento)) throw new ConflictException('El evento cambió; recarga');
        if (!evento.cicloId || !evento.nivelId) throw new BadRequestException('La imagen requiere ciclo y nivel');
        if (evento.imagenNombre) await programarLimpieza(manager, '/uploads/' + evento.imagenNombre);
        evento.imagenNombre = file.filename;
        const actualizado = await repo.save(evento);
        await this.registrarCambio(manager, actualizado, user, 'REEMPLAZAR_IMAGEN', dto.avisar);
        return { ...actualizado, revision: this.revision(actualizado) };
      });
    } catch (e) {
      await fs.unlink(file.path).catch(() => undefined);
      throw e;
    }
  }
  async imagen(id: number, user: JwtUser) {
    const evento = await this.eventos.findOneBy({ id });
    if (!evento) throw new NotFoundException();
    const qb = await this.consulta(user, evento.fechaInicio.toISOString(), evento.fechaInicio.toISOString());
    if (!(await qb.andWhere('e.id = :id', { id }).getOne())) throw new ForbiddenException();
    if (!evento.imagenNombre || !/^calendario-[0-9a-f-]+\.(png|jpg|jpeg|webp)$/.test(evento.imagenNombre))
      throw new NotFoundException();
    return {
      archivo: await fs.readFile(join(uploadsPath(), evento.imagenNombre)),
      tipo: evento.imagenNombre.endsWith('.png')
        ? 'image/png'
        : evento.imagenNombre.endsWith('.webp')
          ? 'image/webp'
          : 'image/jpeg',
    };
  }
}
