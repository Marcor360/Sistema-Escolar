import { createHash } from 'crypto';
import { esMaestroRestringido, exigirConsultaAcademica } from '../common/politica-acceso';
import { CicloEscolar } from '../entities/ciclo-escolar.entity';
import { PaginacionDto } from '../common/paginacion.dto';
import { exigirGrupoVigente, inscripcionVigente } from '../common/contexto-academico';
import { alumnosConFinalDisponible, alumnosConParcialDisponible, calcularPonderada, escalaDe, esRegimenNuevo, notaEnEscala, parcialesDe, propuestaFinal, resultadoEvaluacion } from '../common/regimen-evaluacion';
import { CapturaPonderadaDto } from './ponderacion.dto';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { Calificacion } from '../entities/calificacion.entity';
import { PeriodoCalificacion, EstadoPeriodoCalificacion } from '../entities/periodo-calificacion.entity';
import { HistorialCalificacion } from '../entities/historial-calificacion.entity';
import { GrupoMateria } from '../entities/grupo-materia.entity';
import { DocentesService } from '../docentes/docentes.service';
import { AlumnosService } from '../alumnos/alumnos.service';
import { JwtUser } from '../common/current-user.decorator';
import { AprobarFinalDto, CapturaCalificacionesDto } from './calificaciones.dto';
import { Inscripcion } from '../entities/inscripcion.entity';
import { ScopeService } from '../planteles/scope.service';

@Injectable()
export class CalificacionesService {
  constructor(
    @InjectRepository(Calificacion) private readonly repo: Repository<Calificacion>,
    @InjectRepository(GrupoMateria) private readonly grupoMaterias: Repository<GrupoMateria>,
    @InjectRepository(Inscripcion) private readonly inscripciones: Repository<Inscripcion>,
    @InjectRepository(PeriodoCalificacion) private readonly periodos: Repository<PeriodoCalificacion>,
    @InjectRepository(HistorialCalificacion) private readonly historial: Repository<HistorialCalificacion>,
    private readonly docentes: DocentesService,
    private readonly alumnos: AlumnosService,
    private readonly scope: ScopeService,
    private readonly dataSource: DataSource,
  ) {}

  private async validarGrupoMateria(grupoMateriaId: number, user: JwtUser) {
    exigirConsultaAcademica(user);
    const gm = await this.grupoMaterias.findOne({ where: { id: grupoMateriaId } });
    if (!gm) throw new NotFoundException('Grupo-materia no encontrado');
    if (user.roles.includes('SUPERADMIN')) return gm;
    if (
      esMaestroRestringido(user)
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
    const { capturadas, sinCambios } = await this.dataSource.transaction((manager) => this.capturarEnTransaccion(dto, user, manager));
    return { capturadas, sinCambios };
  }

  /** Comparte validación, bloqueos y auditoría con la importación; el llamador controla la transacción. */
  async capturarEnTransaccion(dto: CapturaCalificacionesDto, user: JwtUser, manager: EntityManager, soloValidar = false, esperadas?: Map<number, string>, detalles?: Map<number, string>, aprobacion?: string) {
    const gm = await this.validarGrupoMateria(dto.grupoMateriaId, user);
    const ids = [...new Set(dto.items.map((item) => item.alumnoId))];
    {
      const cicloActual = await manager.getRepository(CicloEscolar).findOne({ where: { id: gm.grupo.cicloId }, lock: { mode: 'pessimistic_write' } });
      if (!cicloActual?.activo) throw new ConflictException('El ciclo ya fue cerrado');
      const grupoMateria = await manager.getRepository(GrupoMateria).findOne({
        where: { id: gm.id }, lock: { mode: 'pessimistic_write' },
      });
      if (!grupoMateria) throw new NotFoundException('Grupo-materia no encontrado');
      if (!grupoMateria.grupo.activo) throw new ConflictException('El grupo no está activo');
      grupoMateria.grupo.ciclo = cicloActual;
      exigirGrupoVigente(grupoMateria.grupo);
      if (grupoMateria.docenteId !== gm.docenteId && esMaestroRestringido(user)) {
        throw new ForbiddenException('La materia ya no está asignada a este docente');
      }
      this.validarParcial(dto.parcial);
      if (!parcialesDe(grupoMateria).includes(dto.parcial) && dto.parcial !== 0) throw new BadRequestException('Parcial no admitido por el régimen de la clase');
      if (aprobacion) {
        if (!esRegimenNuevo(grupoMateria)) throw new BadRequestException('La aprobación corresponde al régimen de cuatro parciales');
        const alumnoId=dto.items[0].alumnoId;
        const notas=await manager.getRepository(Calificacion).find({where:{grupoMateriaId:grupoMateria.id,alumnoId},loadEagerRelations:false});
        if (aprobacion!==this.revisionFinal(notas,grupoMateria)) throw new ConflictException('Las notas cambiaron; vuelve a cargar la propuesta antes de aprobar');
        const calificacion=propuestaFinal(notas,grupoMateria);
        if (calificacion===null) throw new ConflictException('Faltan parciales para calcular la propuesta');
        dto={...dto,items:[{alumnoId,calificacion}]};
        detalles=new Map([[alumnoId,JSON.stringify({tipo:'APROBACION_FINAL',revision:aprobacion,calificacion,parciales:notas.filter(n=>n.parcial>0).map(n=>({parcial:n.parcial,calificacion:n.calificacion,escalaMaxima:n.escalaMaxima,peso:25}))})]]);
      }
      const escala = escalaDe(grupoMateria);
      if ((esRegimenNuevo(grupoMateria) && dto.escalaMaxima !== 10) || (dto.escalaMaxima !== undefined && dto.escalaMaxima !== escala)) throw new ConflictException(`Actualiza el cliente o la plantilla: esta clase captura en escala 0 a ${escala}`);
      const factor = dto.parcial === 0 && esRegimenNuevo(grupoMateria) ? 1e8 : 1e6;
      if (dto.items.some(i => !Number.isFinite(i.calificacion) || i.calificacion < 0 || i.calificacion > escala || Math.abs(i.calificacion * factor - Math.round(i.calificacion * factor)) > 1e-6)) throw new BadRequestException(`La nota debe estar entre 0 y ${escala}, con hasta ${factor === 1e8 ? 'ocho' : 'seis'} decimales`);
      const periodo = await manager.getRepository(PeriodoCalificacion).findOne({
        where: { grupoMateriaId: gm.id, parcial: dto.parcial },
      });
      if (periodo?.estatus === 'CERRADO') throw new ConflictException('El periodo está cerrado');
      const inscripciones = manager.getRepository(Inscripcion);
      const activos = await inscripciones.find({
        where: { ...inscripcionVigente, estatus: In(['ACTIVA','HISTORICA']), alumnoId: In(ids), grupoId: gm.grupoId },
      });
      const activosIds = new Set(activos.map((i) => i.alumnoId));
      if (ids.some((id) => !activosIds.has(id))) {
        throw new ForbiddenException('Todos los alumnos deben estar inscritos de forma activa en el grupo');
      }
      const calificaciones = manager.getRepository(Calificacion);
      const historial = manager.getRepository(HistorialCalificacion);
      // Una lectura bloqueada por lote evita hidratar expedientes y repetir consultas por alumno.
      const existentes = await calificaciones.find({
        where: { alumnoId: In(ids), grupoMateriaId: dto.grupoMateriaId, parcial: dto.parcial },
        order: { alumnoId: 'ASC' }, lock: { mode: 'pessimistic_write' }, loadEagerRelations: false,
      });
      const porAlumno = new Map(existentes.map((c) => [c.alumnoId,c]));
      const revisiones = ids.map((alumnoId) => { const c = porAlumno.get(alumnoId); return { alumnoId, revision: createHash('sha256').update(JSON.stringify(c ? [c.id, Number(c.calificacion), c.escalaMaxima ?? 100, c.observaciones, c.capturadaPorId, c.updatedAt] : null)).digest('hex') }; });
      if (esperadas && revisiones.some((r) => esperadas.get(r.alumnoId) !== r.revision)) throw new ConflictException('Las notas cambiaron después del preview; genera otra previsualización');
      const cambios = dto.items.flatMap((item) => {
        const existente = porAlumno.get(item.alumnoId);
        const observaciones = item.observaciones === undefined ? existente?.observaciones ?? null : item.observaciones;
        if (existente && notaEnEscala(existente, grupoMateria) === item.calificacion && observaciones === existente.observaciones && !detalles) return [];
        if (existente && !dto.motivo?.trim()) throw new BadRequestException('Debes indicar el motivo para corregir una calificación existente');
        const valorAnterior = existente?.calificacion ?? null, escalaAnterior = existente?.escalaMaxima ?? 100, observacionAnterior = existente?.observaciones ?? null;
        const registro = existente ?? calificaciones.create({ alumnoId: item.alumnoId, grupoMateriaId: dto.grupoMateriaId, parcial: dto.parcial });
        registro.calificacion = item.calificacion; registro.escalaMaxima = escala; registro.observaciones = observaciones; registro.capturadaPorId = user.sub;
        return [{ registro,valorAnterior,escalaAnterior,observacionAnterior }];
      });
      if (cambios.length && !soloValidar) {
        await calificaciones.save(cambios.map((c) => c.registro),{ chunk: 100 });
        const entradas = cambios.map(({ registro,valorAnterior,escalaAnterior,observacionAnterior }) => ({
          calificacionId: registro.id, alumnoId: registro.alumnoId, grupoMateriaId: dto.grupoMateriaId, parcial: dto.parcial,
          valorAnterior, valorNuevo: registro.calificacion, escalaAnterior, escalaNueva: escala, detalleCalculo: detalles?.get(registro.alumnoId) ?? null, observacionAnterior, observacionNueva: registro.observaciones,
          usuarioId: user.sub, motivo: dto.motivo?.trim() || null,
        }));
        for (let i = 0; i < entradas.length; i += 100) await historial.insert(entradas.slice(i,i+100));
      }
      return { capturadas: cambios.length, sinCambios: dto.items.length - cambios.length, revisiones, diferencias: cambios.map((c) => ({ alumnoId: c.registro.alumnoId, anterior: c.valorAnterior === null ? null : Number(c.valorAnterior) * escala / c.escalaAnterior, nueva: c.registro.calificacion })) };
    }
  }

  private revisionFinal(notas:Calificacion[], clase:GrupoMateria):string {
    return createHash('sha256').update(JSON.stringify([clase.regimenEvaluacion,clase.docenteId,
      [...notas].sort((a,b)=>a.parcial-b.parcial).map(n=>[n.id,n.parcial,Number(n.calificacion),n.escalaMaxima,n.updatedAt])])).digest('hex');
  }

  async propuestasFinal(grupoMateriaId:number, user:JwtUser) {
    const clase=await this.validarGrupoMateria(grupoMateriaId,user);
    if (!esRegimenNuevo(clase)) throw new BadRequestException('La aprobación corresponde al régimen de cuatro parciales');
    const [inscritos,notas]=await Promise.all([
      this.inscripciones.find({where:{...inscripcionVigente,estatus:In(['ACTIVA','HISTORICA']),grupoId:clase.grupoId}}),
      this.repo.find({where:{grupoMateriaId},loadEagerRelations:false}),
    ]);
    return inscritos.map(i=>{
      const propias=notas.filter(n=>n.alumnoId===i.alumnoId);
      return {alumnoId:i.alumnoId,propuesta:propuestaFinal(propias,clase),definitiva:resultadoEvaluacion(propias,clase),revision:this.revisionFinal(propias,clase)};
    });
  }

  async aprobarFinal(dto:AprobarFinalDto, user:JwtUser) {
    // Una única ruta transaccional: ninguna lectura externa después de adquirir locks.
    return this.dataSource.transaction(manager=>this.capturarEnTransaccion({
      grupoMateriaId:dto.grupoMateriaId,parcial:0,escalaMaxima:10,motivo:dto.motivo,
      items:[{alumnoId:dto.alumnoId,calificacion:0}],
    },user,manager,false,undefined,undefined,dto.revision));
  }

  async capturarPonderadas(dto: CapturaPonderadaDto, user: JwtUser) {
    const clase = await this.validarGrupoMateria(dto.grupoMateriaId, user);
    if (!esRegimenNuevo(clase) || !parcialesDe(clase).includes(dto.parcial)) throw new BadRequestException('La ponderación corresponde a P1–P4 del régimen 0–10');
    const detalles = new Map<number, string>();
    let items: CapturaCalificacionesDto['items'];
    try {
      items = dto.items.map(item => {
        const calificacion = calcularPonderada(dto.criterios, item.notas);
        detalles.set(item.alumnoId, JSON.stringify({ criterios: dto.criterios, notas: item.notas, calificacion }));
        return { alumnoId: item.alumnoId, calificacion };
      });
    } catch (error) { throw new BadRequestException((error as Error).message); }
    return this.dataSource.transaction(manager => this.capturarEnTransaccion({
      grupoMateriaId: dto.grupoMateriaId, parcial: dto.parcial, escalaMaxima: 10, motivo: dto.motivo, items,
    }, user, manager, false, undefined, detalles));
  }

  private validarParcial(parcial: number): void {
    if (!Number.isInteger(parcial) || parcial < 0 || parcial > 4) {
      throw new BadRequestException('El parcial debe estar entre 0 y 4');
    }
  }

  async estadoPeriodo(grupoMateriaId: number, parcial: number, user: JwtUser) {
    this.validarParcial(parcial);
    const clase = await this.validarGrupoMateria(grupoMateriaId, user);
    if (parcial === 4 && !esRegimenNuevo(clase)) throw new BadRequestException('La clase histórica tiene tres parciales');
    const periodo = await this.periodos.findOne({ where: { grupoMateriaId, parcial } });
    const gm = await this.grupoMaterias.findOneOrFail({ where: { id: grupoMateriaId } });
    const inscritos = await this.inscripciones.find({ where: { ...inscripcionVigente, estatus:In(['ACTIVA','HISTORICA']), grupoId: gm.grupoId } });
    const registros = await this.repo.find({ where: { grupoMateriaId, parcial } });
    let capturados = new Set(registros.map((c) => c.alumnoId));
    if (esRegimenNuevo(clase)) {
      const todas = await this.repo.find({where:{grupoMateriaId},loadEagerRelations:false});
      capturados = parcial === 0 ? alumnosConFinalDisponible(todas) : alumnosConParcialDisponible(todas,parcial);
    }
    const faltantes = inscritos.filter((i) => !capturados.has(i.alumnoId)).length;
    return { grupoMateriaId, parcial, escalaMaxima: escalaDe(clase), regimenEvaluacion: clase.regimenEvaluacion ?? 'LEGADO_100', parciales: parcialesDe(clase), redondeoAutomatico: false, estatus: periodo?.estatus ?? 'ABIERTO', inscritos: inscritos.length,
      capturados: inscritos.length - faltantes, faltantes };
  }

  async cambiarEstadoPeriodo(
    grupoMateriaId: number, parcial: number, estatus: EstadoPeriodoCalificacion, user: JwtUser,
  ) {
    this.validarParcial(parcial);
    const previa = await this.grupoMaterias.findOne({ where: { id: grupoMateriaId } });
    if (!previa) throw new NotFoundException('Grupo-materia no encontrado');
    await this.scope.validarGestion(user, previa.grupo.plantelId);
    return this.dataSource.transaction(async (manager) => {
      const cicloActual = await manager.getRepository(CicloEscolar).findOne({ where: { id: previa.grupo.cicloId }, lock: { mode: 'pessimistic_write' } });
      if (!cicloActual?.activo) throw new ConflictException('El ciclo ya fue cerrado');
      const gm = await manager.getRepository(GrupoMateria).findOne({
        where: { id: grupoMateriaId }, lock: { mode: 'pessimistic_write' },
      });
      if (!gm) throw new NotFoundException('Grupo-materia no encontrado');
      await this.scope.validarGestion(user, gm.grupo.plantelId);
      gm.grupo.ciclo = cicloActual;
      exigirGrupoVigente(gm.grupo);
      if (parcial === 4 && !esRegimenNuevo(gm)) throw new BadRequestException('La clase histórica tiene tres parciales');
      if (estatus === 'CERRADO') {
        const inscritos = await manager.getRepository(Inscripcion).find({ where: { ...inscripcionVigente, estatus:In(['ACTIVA','HISTORICA']), grupoId: gm.grupoId } });
        const notas = await manager.getRepository(Calificacion).find({ where: { grupoMateriaId, parcial } });
        let capturados = new Set(notas.map((c) => c.alumnoId));
        if (esRegimenNuevo(gm)) {
          const todas = await manager.getRepository(Calificacion).find({where:{grupoMateriaId},loadEagerRelations:false});
          capturados = parcial === 0 ? alumnosConFinalDisponible(todas) : alumnosConParcialDisponible(todas,parcial);
        }
        if (inscritos.some((i) => !capturados.has(i.alumnoId))) throw new ConflictException('No puedes cerrar el periodo: hay alumnos sin calificación');
      }
      const periodos = manager.getRepository(PeriodoCalificacion);
      const periodo = await periodos.findOne({ where: { grupoMateriaId, parcial } }) ??
        periodos.create({ grupoMateriaId, parcial, estatus: 'ABIERTO' });
      if (periodo.estatus !== estatus) {
        periodo.estatus = estatus;
        if (parcial === 4 && !esRegimenNuevo(gm)) throw new BadRequestException('La clase histórica tiene tres parciales');
      if (estatus === 'CERRADO') {
          periodo.cerradoPorId = user.sub;
          periodo.cerradoAt = new Date();
        } else {
          periodo.reabiertoPorId = user.sub;
          periodo.reabiertoAt = new Date();
        }
      }
      await periodos.save(periodo);
      return { grupoMateriaId, parcial, estatus: periodo.estatus };
    });
  }

  async historialPeriodo(grupoMateriaId: number, parcial: number, user: JwtUser, query: PaginacionDto = new PaginacionDto()) {
    this.validarParcial(parcial);
    await this.validarGrupoMateria(grupoMateriaId, user);
    const { pagina, porPagina } = query;
    const [datos, total] = await this.historial.findAndCount({
      where: { grupoMateriaId, parcial }, order: { id: 'DESC' }, skip: (pagina - 1) * porPagina, take: porPagina,
    });
    return { datos, total, pagina, porPagina };
  }

  async porGrupoMateria(grupoMateriaId: number, user: JwtUser, parcial?: number) {
    await this.validarGrupoMateria(grupoMateriaId, user);
    if (parcial !== undefined) this.validarParcial(parcial);
    const registros = await this.repo.find({
      where: parcial !== undefined ? { grupoMateriaId, parcial } : { grupoMateriaId },
      order: { alumnoId: 'ASC', parcial: 'ASC' },
    });
    return registros.map((registro) => this.proyectar(registro));
  }

  async porAlumno(alumnoId: number, user: JwtUser, cicloId?: number) {
    exigirConsultaAcademica(user);
    const alumno = await this.alumnos.obtener(alumnoId);
    if (
      esMaestroRestringido(user)
    ) {
      const docente = await this.docentes.obtenerPorUsuario(user.sub);
      const asignaciones = await this.grupoMaterias.find({ where: { docenteId: docente.id } });
      const asignacionesActivas = asignaciones.filter((gm) => gm.grupo.activo && gm.grupo.ciclo.activo && gm.grupo.plantel.activo && (!cicloId || gm.grupo.cicloId === cicloId));
      const grupoIds = [...new Set(asignacionesActivas.map((gm) => gm.grupoId))];
      if (grupoIds.length === 0) throw new ForbiddenException('El alumno no pertenece a uno de tus grupos');
      const inscripcionesActivas = await this.inscripciones.find({
        where: { alumnoId, grupoId: In(grupoIds), estatus: In(['ACTIVA','HISTORICA']) },
      });
      const gruposActivos = new Set(inscripcionesActivas.map((i) => i.grupoId));
      const grupoMateriaIds = asignacionesActivas.filter((gm) => gruposActivos.has(gm.grupoId)).map((gm) => gm.id);
      if (grupoMateriaIds.length === 0) throw new ForbiddenException('El alumno no pertenece a uno de tus grupos');
      const registros = await this.repo.find({
        where: { alumnoId, grupoMateriaId: In(grupoMateriaIds) },
        order: { grupoMateriaId: 'ASC', parcial: 'ASC' },
      });
      return this.proyectarConPromedio(registros);
    } else if (!user.roles.includes('SUPERADMIN')) {
      await this.scope.validarGestion(user, alumno.plantelId);
    }
    const permitidos = await this.scope.plantelesDe(user);
    const registros = await this.repo.find({ where: { alumnoId, grupoMateria: { grupo: {
      ...(cicloId ? { cicloId } : { activo: true, ciclo: { activo: true }, plantel: { activo: true } }),
      ...(permitidos === null ? {} : { plantelId: In(permitidos) }),
    } } }, order: { grupoMateriaId: 'ASC', parcial: 'ASC' } });
    return this.proyectarConPromedio(registros);
  }

  async mias(user: JwtUser, cicloId?: number) {
    const alumno = await this.alumnos.obtenerPorUsuario(user.sub);
    const activas = cicloId ? null : await this.inscripciones.find({ where: { ...inscripcionVigente, alumnoId: alumno.id } });
    if (activas?.length === 0) return [];
    const registros = await this.repo.find({
      where: { alumnoId: alumno.id, grupoMateria: { grupo: cicloId ? { cicloId } : { id: In(activas!.map((i) => i.grupoId)), ciclo: { activo: true } } } },
      order: { grupoMateriaId: 'ASC', parcial: 'ASC' },
    });
    return this.proyectarConPromedio(registros);
  }

  async consultarMias(user:JwtUser,q:PaginacionDto) {
    const alumno=await this.alumnos.obtenerPorUsuario(user.sub);
    const activas=await this.inscripciones.find({where:{...inscripcionVigente,alumnoId:alumno.id}});
    if(!activas.length) return {datos:[],total:0,pagina:q.pagina,porPagina:q.porPagina};
    const [registros,total]=await this.repo.findAndCount({where:{alumnoId:alumno.id,grupoMateria:{grupo:{id:In(activas.map(i=>i.grupoId)),ciclo:{activo:true}}}},order:{grupoMateriaId:'ASC',parcial:'ASC',id:'ASC'},skip:(q.pagina-1)*q.porPagina,take:q.porPagina});
    const clases=[...new Set(registros.map(r=>r.grupoMateriaId))];
    // Solo recupera las evaluaciones de las materias de la página (máximo 100),
    // para que un límite entre páginas nunca cambie el promedio oficial.
    const notas=clases.length ? await this.repo.find({where:{alumnoId:alumno.id,grupoMateriaId:In(clases)},select:{grupoMateriaId:true,parcial:true,calificacion:true,escalaMaxima:true},loadEagerRelations:false}) : [];
    const promedios=new Map(clases.map(id=>[id,resultadoEvaluacion(notas.filter(n=>n.grupoMateriaId===id), registros.find(r=>r.grupoMateriaId===id)!.grupoMateria)]));
    return {datos:registros.map(r=>({...this.proyectar(r),promedioOficial:promedios.get(r.grupoMateriaId) ?? null})),total,pagina:q.pagina,porPagina:q.porPagina};
  }

  private proyectarConPromedio(registros: Calificacion[]) {
    return registros.map((registro) => ({ ...this.proyectar(registro), promedioOficial: resultadoEvaluacion(registros.filter((c) => c.grupoMateriaId === registro.grupoMateriaId), registro.grupoMateria) }));
  }

  private proyectar(registro: Calificacion) {
    return {
      id: registro.id,
      alumnoId: registro.alumnoId,
      grupoMateriaId: registro.grupoMateriaId,
      parcial: registro.parcial,
      calificacion: notaEnEscala(registro, registro.grupoMateria),
      calificacionOriginal: Number(registro.calificacion),
      escalaOriginal: registro.escalaMaxima ?? 100,
      escalaMaxima: escalaDe(registro.grupoMateria),
      regimenEvaluacion: registro.grupoMateria.regimenEvaluacion ?? 'LEGADO_100',
      origenFinal: registro.parcial === 0 ? 'REGISTRADA' : null,
      observaciones: registro.observaciones,
      grupoMateria: registro.grupoMateria ? {
        id: registro.grupoMateria.id,
        grupo: registro.grupoMateria.grupo ? {
          id: registro.grupoMateria.grupo.id,
          nombre: registro.grupoMateria.grupo.nombre,
          ciclo: registro.grupoMateria.grupo.ciclo ? {
            id: registro.grupoMateria.grupo.ciclo.id, nombre: registro.grupoMateria.grupo.ciclo.nombre,
          } : undefined,
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
