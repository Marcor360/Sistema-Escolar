import { evaluarOrigenReinscripcion, MateriaPendiente } from './evaluacion-reinscripcion';
import { cotizarCuotasReinscripcion, Cuota } from './cuotas-reinscripcion';
import { resumenCarteraAlumno } from './resumen-cartera';
import { AgrupacionRegularService, ContextoRegular } from '../academico/agrupacion-regular.service';
import { materializarAperturas } from './materializar-aperturas';
import { condicionBusquedaAlumno } from '../common/busqueda-alumno';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { DataSource, EntityManager, In } from 'typeorm';
import {
  Alumno,
  AutorizacionReinscripcion,
  BitacoraAcademica,
  BitacoraFinanciera,
  Cargo,
  CicloEscolar,
  ConceptoPago,
  Grupo,
  Inscripcion,
  ParticipacionAsignatura,
  PeriodoAcademico,
  SolicitudGrupoRegular,
  Plantel,
  ReinscripcionPeriodo,
  Usuario,
} from '../entities';
import { JwtUser } from '../common/current-user.decorator';
import { ScopeService } from '../planteles/scope.service';
import { validarContextoGrupo } from '../catalogos-academicos/contexto-grupo';
import { limiteRegulares } from '../recursamientos/acceso-recursamiento';
import { planificarGruposRegulares } from '../academico/distribucion-grupos';
import { esConflictoTransaccional, esConflictoUnico } from '../academico/conflictos';
import { ListarCarteraDto } from './cartera.dto';
import {
  AnularReinscripcionDto,
  AutorizarReinscripcionDto,
  ConfirmarPeriodoDto,
  ReinscripcionPeriodoDto,
} from './reinscripcion-periodo.dto';
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const centavos = (v: number) => Math.round(v * 100);
interface Cotizacion {
  peticion: ReinscripcionPeriodoDto;
  conceptos: Cuota[];
  total: number;
  cotizacion: string;
  academicoHash: string;
  movimiento: string;
  pendientes: MateriaPendiente[];
  sinMaterias: boolean;
  ventana: [string, string];
  destino: { periodo: string; tipo: string; numero: number; ciclo: string; grupoId: number | null };
}
@Injectable()
export class ReinscripcionPeriodoService {
  constructor(
    private readonly ds: DataSource,
    private readonly scope: ScopeService,
    private readonly agrupacion: AgrupacionRegularService,
  ) {}
  private exigir(u: JwtUser, roles: string[]) {
    if (!u.roles.includes('SUPERADMIN') && !roles.some((r) => u.roles.includes(r)))
      throw new ForbiddenException('No tienes permiso para esta operación de reinscripción');
  }
  private async tx<T>(f: (m: EntityManager) => Promise<T>): Promise<T> {
    for (let intento = 0; intento < 3; intento++) {
      try {
        return await this.ds.transaction('READ COMMITTED', f);
      } catch (e) {
        if (esConflictoTransaccional(e) && intento < 2) continue;
        if (esConflictoUnico(e) || esConflictoTransaccional(e))
          throw new ConflictException(
            'La reinscripción cambió concurrentemente; consulta la operación y reintenta con la misma clave',
          );
        throw e;
      }
    }
    throw new ConflictException('No se pudo estabilizar la reinscripción');
  }
  async trayectoria(alumnoId: number, u: JwtUser) {
    this.exigir(u, ['ADMINISTRATIVO', 'FINANZAS']);
    const alumno = await this.ds.getRepository(Alumno).findOneBy({ id: alumnoId });
    if (!alumno) throw new NotFoundException('Alumno no encontrado');
    await this.scope.validarGestion(u, alumno.plantelId);
    const todas = await this.ds.getRepository(Inscripcion).find({
      where: { alumnoId, estatus: 'ACTIVA', grupo: { tipo: 'REGULAR', plantelId: alumno.plantelId } },
      order: { id: 'DESC' },
    });
    const origen = todas.find((i) => i.grupo.periodoAcademicoId !== null);
    if (!origen) throw new ConflictException('No hay inscripción regular vigente con periodo configurado');
    const p = await this.ds.getRepository(PeriodoAcademico).findOneByOrFail({ id: origen.grupo.periodoAcademicoId! });
    const recursamientos = await this.ds
      .getRepository(ParticipacionAsignatura)
      .find({
        where: { alumnoId, estado: 'ACTIVA', grupoMateria: { grupo: { plantelId: alumno.plantelId } } },
        loadEagerRelations: false,
      });
    const academico = u.roles.some((r) => ['ADMINISTRATIVO', 'SUPERADMIN'].includes(r))
      ? await evaluarOrigenReinscripcion(this.ds.manager, origen)
      : undefined;
    return {
      financiero: await resumenCarteraAlumno(this.ds.manager, alumno.id, alumno.plantelId),
      alumno: {
        id: alumno.id,
        matricula: alumno.matricula,
        nombre: alumno.usuario.nombreCompleto,
        plantelId: alumno.plantelId,
      },
      origen: {
        inscripcionId: origen.id,
        grupo: origen.grupo.nombre,
        cicloId: origen.grupo.cicloId,
        nivelId: origen.grupo.nivelId,
        carreraId: origen.grupo.carreraId,
        periodoAcademicoId: p.id,
        periodo: p.nombre,
        tipo: p.tipo,
        numero: p.numero,
        turno: origen.grupo.turno,
        fechaFin: origen.grupo.ciclo.fechaFin,
      },
      ...(academico
        ? {
            academico,
            recursamientos: recursamientos.map((r) => ({
              id: r.id,
              grupoMateriaId: r.grupoMateriaId,
              intento: r.intento,
            })),
          }
        : {}),
      advertencia:
        'Las materias pendientes no se aprueban ni los recursamientos se duplican por reinscribir. El origen se conserva hasta asignar el nuevo grupo.',
    };
  }
  private async cotizar(m: EntityManager, d: ReinscripcionPeriodoDto, u: JwtUser): Promise<Cotizacion> {
    this.exigir(u, ['ADMINISTRATIVO', 'FINANZAS']);
    await this.scope.validarGestion(u, d.plantelId);
    const primera = await m.getRepository(Inscripcion).findOneBy({ id: d.origenInscripcionId, alumnoId: d.alumnoId });
    if (!primera) throw new ConflictException('La inscripción de origen no corresponde al alumno');
    await m.getRepository(CicloEscolar).find({
      where: { id: In([...new Set([primera.grupo.cicloId, d.cicloId])]) },
      order: { id: 'ASC' },
      lock: { mode: 'pessimistic_write' },
      loadEagerRelations: false,
    });
    const plantel = await m
      .getRepository(Plantel)
      .findOne({ where: { id: d.plantelId }, lock: { mode: 'pessimistic_write' } });
    if (!plantel?.activo) throw new ConflictException('Plantel inactivo');
    await validarContextoGrupo(m, d);
    const alumno = await m
      .getRepository(Alumno)
      .findOne({ where: { id: d.alumnoId }, lock: { mode: 'pessimistic_write' } });
    if (!alumno || alumno.estatus !== 'ACTIVO' || !alumno.usuario.activo || alumno.plantelId !== d.plantelId)
      throw new ConflictException('El alumno no está activo en el plantel');
    const origen = await m
      .getRepository(Inscripcion)
      .findOneByOrFail({ id: d.origenInscripcionId, alumnoId: d.alumnoId });
    if (
      origen.estatus !== 'ACTIVA' ||
      origen.grupo.tipo !== 'REGULAR' ||
      origen.grupo.plantelId !== d.plantelId ||
      !origen.grupo.periodoAcademicoId
    )
      throw new ConflictException('Se requiere la inscripción regular vigente del mismo plantel');
    if (
      await m
        .getRepository(SolicitudGrupoRegular)
        .existsBy({ alumnoId: d.alumnoId, cicloId: d.cicloId, estado: 'PENDIENTE' })
    )
      throw new ConflictException('Resuelve la apertura ordinaria pendiente antes de reinscribir');
    const activas = await m
      .getRepository(Inscripcion)
      .find({ where: { alumnoId: d.alumnoId, estatus: 'ACTIVA', grupo: { cicloId: d.cicloId, tipo: 'REGULAR' } } });
    if (activas.some((i) => i.id !== origen.id))
      throw new ConflictException('Ya existe otra inscripción regular vigente en el ciclo destino');
    const anterior = await m.getRepository(PeriodoAcademico).findOneByOrFail({ id: origen.grupo.periodoAcademicoId });
    const destino = await m.getRepository(PeriodoAcademico).findOneByOrFail({ id: d.periodoAcademicoId });
    const ciclo = await m.getRepository(CicloEscolar).findOneByOrFail({ id: d.cicloId });
    if (origen.grupo.nivelId !== d.nivelId || origen.grupo.carreraId !== d.carreraId || anterior.tipo !== destino.tipo)
      throw new ConflictException('El destino debe respetar nivel, plan y modalidad configurados');
    const mismo = origen.grupo.cicloId === d.cicloId;
    if (
      !['ACTIVO', 'PREPARACION'].includes(ciclo.estado) ||
      (!mismo && (origen.grupo.ciclo.estado !== 'CERRADO' || ciclo.fechaInicio <= origen.grupo.ciclo.fechaFin))
    )
      throw new ConflictException('Usa el mismo ciclo vigente o un ciclo posterior al origen cerrado');
    if (mismo && (!destino.fechaInicio || !destino.fechaFin))
      throw new ConflictException(
        'Configura las fechas reales del periodo destino antes de reinscribir dentro del ciclo',
      );
    const inicio = destino.fechaInicio ?? ciclo.fechaInicio,
      fin = destino.fechaFin ?? ciclo.fechaFin;
    if (inicio > fin || inicio < ciclo.fechaInicio || fin > ciclo.fechaFin)
      throw new ConflictException('El calendario del periodo debe estar dentro del ciclo');
    if (d.grupoId) {
      const g = await m.getRepository(Grupo).findOneBy({
        id: d.grupoId,
        plantelId: d.plantelId,
        cicloId: d.cicloId,
        nivelId: d.nivelId,
        carreraId: d.carreraId,
        periodoAcademicoId: d.periodoAcademicoId,
        turno: d.turno,
        tipo: 'REGULAR',
        activo: true,
      });
      if (!g) throw new ConflictException('Grupo destino incompatible');
      if (await m.getRepository(Inscripcion).existsBy({ alumnoId: d.alumnoId, grupoId: g.id }))
        throw new ConflictException(
          'Ese grupo ya forma parte del historial del alumno; selecciona otro grupo para conservar sus notas e intentos',
        );
    }
    if(d.grupoId && await m.getRepository(ParticipacionAsignatura).existsBy({alumnoId:d.alumnoId,estado:'ACTIVA',grupoMateria:{grupoId:d.grupoId}}))throw new ConflictException('El alumno ya recursa en el grupo destino; selecciona otro grupo para no duplicar el intento');
    const academico = await evaluarOrigenReinscripcion(m, origen),
      movimiento =
        destino.numero === anterior.numero + 1
          ? 'AVANCE'
          : destino.numero < anterior.numero
            ? 'RETROCESO'
            : destino.numero === anterior.numero
              ? 'REPETICION'
              : 'SALTO';
    if (
      (movimiento !== 'AVANCE' || academico.pendientes.length || academico.sinMaterias) &&
      (!d.motivo?.trim() || d.motivo.trim().length < 10 || !d.documentoRef?.trim() || d.documentoRef.trim().length < 5)
    )
      throw new ConflictException(
        'El movimiento excepcional o con materias pendientes exige motivo y referencia documental de Control Escolar',
      );
    if ((academico.pendientes.length || academico.sinMaterias) && d.condicion !== 'CONDICIONAL')
      throw new ConflictException(
        'Faltan resultados definitivos aprobatorios publicados; Control Escolar debe autorizar expresamente el avance condicional',
      );
    const conceptos = await m.getRepository(ConceptoPago).find({
      where: { id: In(d.conceptoIds), activo: true },
      order: { id: 'ASC' },
      lock: { mode: 'pessimistic_read' },
    });
    const { ajustes, cuotas } = cotizarCuotasReinscripcion(d, conceptos, inicio, fin);
    const peticion: ReinscripcionPeriodoDto = {
      alumnoId: d.alumnoId,
      plantelId: d.plantelId,
      cicloId: d.cicloId,
      nivelId: d.nivelId,
      carreraId: d.carreraId,
      periodoAcademicoId: d.periodoAcademicoId,
      turno: d.turno,
      ...(d.grupoId ? { grupoId: d.grupoId } : {}),
      conceptoIds: [...d.conceptoIds].sort((a, b) => a - b),
      periodo: d.periodo,
      fechaVencimiento: d.fechaVencimiento,
      origenInscripcionId: d.origenInscripcionId,
      condicion: d.condicion ?? 'ORDINARIA',
      motivo: d.motivo?.trim(),
      documentoRef: d.documentoRef?.trim(),
      ajustes: [...ajustes].sort((a, b) => a.conceptoId - b.conceptoId),
      parcialidades: cuotas.map((q) => ({
        conceptoId: q.conceptoId,
        periodo: q.periodo,
        fechaVencimiento: q.fechaVencimiento,
        monto: q.monto,
        descuento: q.descuento,
      })),
    };
    return {
      peticion,
      conceptos: cuotas,
      total: cuotas.reduce((s, q) => s + centavos(q.monto) - centavos(q.descuento), 0) / 100,
      cotizacion: hash({
        peticion,
        cuotas,
        academicoHash: academico.academicoHash,
        calendario: [inicio, fin],
        tarifas: conceptos.map((c) => [c.id, c.montoBase]),
      }),
      movimiento,
      ...academico,
      ventana: [inicio, fin],
      destino: {
        periodo: destino.nombre,
        tipo: destino.tipo,
        numero: destino.numero,
        ciclo: ciclo.nombre,
        grupoId: d.grupoId ?? null,
      },
    };
  }
  private visible(c: Cotizacion, u: JwtUser) {
    const { academicoHash, pendientes, sinMaterias, ...resto } = c;
    void academicoHash;
    return {
      ...resto,
      ...(u.roles.some((r) => ['ADMINISTRATIVO', 'SUPERADMIN'].includes(r)) ? { pendientes, sinMaterias } : {}),
    };
  }
  preview(d: ReinscripcionPeriodoDto, u: JwtUser) {
    return this.tx(async (m) => this.visible(await this.cotizar(m, d, u), u));
  }
  autorizar(d: AutorizarReinscripcionDto, u: JwtUser) {
    this.exigir(u, ['FINANZAS']);
    return this.tx(async (m) => {
      const c = await this.cotizar(m, d, u);
      if (c.cotizacion !== d.cotizacion) throw new ConflictException('La cotización cambió; vuelve a previsualizar');
      const a = await m.getRepository(AutorizacionReinscripcion).save({
        alumnoId: d.alumnoId,
        plantelId: d.plantelId,
        financieroId: u.sub,
        cotizacion: c.cotizacion,
        peticionJson: JSON.stringify(c.peticion),
        snapshotJson: JSON.stringify(c),
        estado: 'AUTORIZADA',
        venceAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
      await m.getRepository(BitacoraFinanciera).insert({
        usuarioId: u.sub,
        plantelId: d.plantelId,
        accion: 'REINSCRIPCION_PRECIO_AUTORIZADO',
        entidad: 'autorizacion',
        entidadId: a.id,
        detalle: `cotizacion=${c.cotizacion}; total=${c.total}; solo periodo destino`,
      });
      return { autorizacionId: a.id, venceAt: a.venceAt, ...this.visible(c, u) };
    });
  }
  async autorizaciones(alumnoId: number, u: JwtUser) {
    this.exigir(u, ['ADMINISTRATIVO', 'FINANZAS']);
    const alumno = await this.ds.getRepository(Alumno).findOneBy({ id: alumnoId });
    if (!alumno) throw new NotFoundException('Alumno no encontrado');
    await this.scope.validarGestion(u, alumno.plantelId);
    const filas = await this.ds.getRepository(AutorizacionReinscripcion).find({
      where: { alumnoId, plantelId: alumno.plantelId, estado: 'AUTORIZADA' },
      order: { id: 'DESC' },
      take: 30,
    });
    return filas
      .filter((a) => a.venceAt > new Date())
      .map((a) => ({
        id: a.id,
        financieroId: a.financieroId,
        venceAt: a.venceAt,
        ...this.visible(JSON.parse(a.snapshotJson) as Cotizacion, u),
      }));
  }
  private recibo(r: ReinscripcionPeriodo) {
    const c = JSON.parse(r.snapshotJson) as Cotizacion;
    return {
      id: r.id,
      tipo: 'REINSCRIPCION',
      estado: r.estado,
      alumnoId: r.alumnoId,
      plantelId: r.plantelId,
      cicloId: r.cicloId,
      origenInscripcionId: r.origenInscripcionId,
      periodoAcademicoId: r.periodoAcademicoId,
      grupoId: r.grupoId,
      inscripcionDestinoId: r.inscripcionDestinoId,
      autorizacionId: r.autorizacionId,
      total: c.total,
      conceptos: c.conceptos,
      cargoIds: JSON.parse(r.cargosJson) as number[],
      fecha: r.createdAt,
    };
  }
  confirmar(d: ConfirmarPeriodoDto, u: JwtUser) {
    this.exigir(u, ['ADMINISTRATIVO']);
    return this.tx(async (m) => {
      const a = await m.getRepository(AutorizacionReinscripcion).findOneBy({ id: d.autorizacionId });
      if (!a) throw new NotFoundException('Autorización no encontrada');
      await this.scope.validarGestion(u, a.plantelId);
      const p = JSON.parse(a.peticionJson) as ReinscripcionPeriodoDto;
      await m.getRepository(CicloEscolar).find({
        where: {
          id: In([
            ...new Set([
              p.cicloId,
              (await m.getRepository(Inscripcion).findOneByOrFail({ id: p.origenInscripcionId })).grupo.cicloId,
            ]),
          ]),
        },
        order: { id: 'ASC' },
        lock: { mode: 'pessimistic_write' },
        loadEagerRelations: false,
      });
      await m.getRepository(Plantel).findOne({ where: { id: a.plantelId }, lock: { mode: 'pessimistic_write' } });
      const repo = m.getRepository(ReinscripcionPeriodo),
        peticionHash = hash({ autorizacionId: d.autorizacionId, cotizacion: d.cotizacion });
      const anterior = await repo.findOneBy({ idempotencia: d.idempotencia });
      if (anterior) {
        if (anterior.creadoPorId !== u.sub || anterior.peticionHash !== peticionHash)
          throw new ConflictException('Idempotencia asociada a otra operación');
        await this.scope.validarGestion(u, anterior.plantelId);
        return this.recibo(anterior);
      }
      const autorizacion = await m
        .getRepository(AutorizacionReinscripcion)
        .findOneOrFail({ where: { id: a.id }, lock: { mode: 'pessimistic_write' } });
      if (
        autorizacion.estado !== 'AUTORIZADA' ||
        autorizacion.venceAt <= new Date() ||
        autorizacion.cotizacion !== d.cotizacion
      )
        throw new ConflictException('Autorización utilizada, vencida o diferente de la cotización');
      const financiero = await m
        .getRepository(Usuario)
        .findOne({ where: { id: a.financieroId, activo: true }, relations: { roles: true } });
      if (!financiero?.email || !financiero.roles.some((r) => ['FINANZAS', 'SUPERADMIN'].includes(r.clave)))
        throw new ConflictException('La autorización necesita un responsable financiero vigente');
      await this.scope.validarGestion(
        {
          sub: financiero.id,
          email: financiero.email,
          nombre: financiero.nombreCompleto,
          roles: financiero.roles.map((r) => r.clave),
        },
        a.plantelId,
      );
      const c = await this.cotizar(m, p, u);
      if (c.cotizacion !== d.cotizacion)
        throw new ConflictException(
          'Cambió el origen, las notas, el calendario o las tarifas; solicita nueva autorización',
        );
      if (await repo.existsBy({ claveOrigen: `INSCRIPCION:${p.origenInscripcionId}` }))
        throw new ConflictException('El origen ya tiene una reinscripción; consulta o anula la solicitud pendiente');
      const r = await repo.save(
        repo.create({
          idempotencia: d.idempotencia,
          peticionHash,
          claveOrigen: `INSCRIPCION:${p.origenInscripcionId}`,
          alumnoId: p.alumnoId,
          plantelId: p.plantelId,
          cicloId: p.cicloId,
          origenInscripcionId: p.origenInscripcionId,
          periodoAcademicoId: p.periodoAcademicoId,
          nivelId: p.nivelId,
          carreraId: p.carreraId,
          turno: p.turno,
          grupoId: null,
          inscripcionDestinoId: null,
          autorizacionId: a.id,
          creadoPorId: u.sub,
          estado: 'PENDIENTE',
          academicoHash: c.academicoHash,
          snapshotJson: JSON.stringify(c),
          cargosJson: '[]',
        }),
      );
      await m.getRepository(AutorizacionReinscripcion).update(a.id, { estado: 'UTILIZADA' });
      if (!p.grupoId) await this.prepararMixta(m, p, u, 0);
      await this.agrupar(m, r, p.grupoId, u);
      await m.getRepository(BitacoraAcademica).insert({
        usuarioId: u.sub,
        plantelId: r.plantelId,
        accion: 'REINSCRIPCION_SOLICITADA',
        entidadId: r.id,
        detalle: `origen=${r.origenInscripcionId}; periodo=${r.periodoAcademicoId}; autorizacion=${a.id}; movimiento=${c.movimiento}`,
        fecha: new Date(),
      });
      return this.recibo(await repo.findOneByOrFail({ id: r.id }));
    });
  }
  private async origenVigente(m: EntityManager, r: ReinscripcionPeriodo) {
    const alumno = await m
        .getRepository(Alumno)
        .findOne({ where: { id: r.alumnoId }, lock: { mode: 'pessimistic_write' } }),
      origen = await m.getRepository(Inscripcion).findOneBy({ id: r.origenInscripcionId, alumnoId: r.alumnoId });
    const p = await m.getRepository(PeriodoAcademico).findOneBy({ id: r.periodoAcademicoId }),
      ciclo = await m.getRepository(CicloEscolar).findOneBy({ id: r.cicloId }),
      c = JSON.parse(r.snapshotJson) as Cotizacion;
    const otras = await m
      .getRepository(Inscripcion)
      .find({ where: { alumnoId: r.alumnoId, estatus: 'ACTIVA', grupo: { cicloId: r.cicloId, tipo: 'REGULAR' } } });
    return !!(
      alumno?.estatus === 'ACTIVO' &&
      alumno.usuario.activo &&
      alumno.plantelId === r.plantelId &&
      origen?.estatus === 'ACTIVA' &&
      origen.grupo.plantelId === r.plantelId &&
      p?.activo &&
      ciclo &&
      ['ACTIVO', 'PREPARACION'].includes(ciclo.estado) &&
      hash([p.fechaInicio ?? ciclo.fechaInicio, p.fechaFin ?? ciclo.fechaFin]) === hash(c.ventana) &&
      !otras.some((i) => i.id !== r.origenInscripcionId) &&
      (await evaluarOrigenReinscripcion(m, origen)).academicoHash === r.academicoHash
    );
  }
  private async asignar(m: EntityManager, r: ReinscripcionPeriodo, g: Grupo, u: JwtUser) {
    const inscripciones = m.getRepository(Inscripcion);
    const otras = await inscripciones.find({
      where: { alumnoId: r.alumnoId, estatus: 'ACTIVA', grupo: { cicloId: r.cicloId, tipo: 'REGULAR' } },
    });
    if (otras.some((i) => i.id !== r.origenInscripcionId))
      throw new ConflictException('El alumno ya tiene otra inscripción regular en el destino');
    if (
      await m
        .getRepository(ParticipacionAsignatura)
        .existsBy({ alumnoId: r.alumnoId, estado: 'ACTIVA', grupoMateria: { grupoId: g.id } })
    )
      throw new ConflictException(
        'El alumno ya recursa una materia de este grupo; selecciona otro destino sin duplicar el intento',
      );
    if (await inscripciones.existsBy({ alumnoId: r.alumnoId, grupoId: g.id }))
      throw new ConflictException('No se reutiliza un grupo del historial académico del alumno');
    const c = JSON.parse(r.snapshotJson) as Cotizacion,
      cargos = m.getRepository(Cargo),
      ids: number[] = [];
    for (const [i, q] of c.conceptos.entries()) {
      const previos = await cargos.find({ where: { alumnoId: r.alumnoId, cicloId: r.cicloId, periodo: q.periodo } });
      if (
        previos.some(
          (v) =>
            v.estatus !== 'CANCELADO' &&
            (v.conceptoId === q.conceptoId || (v.concepto.tipo === 'COLEGIATURA' && q.tipo === 'COLEGIATURA')),
        )
      )
        throw new ConflictException(
          'Existe un cargo del mismo concepto/mes; Finanzas debe conciliarlo antes de reinscribir sin duplicarlo',
        );
      const cargo = await cargos.save(
        cargos.create({
          plantelId: r.plantelId,
          alumnoId: r.alumnoId,
          cicloId: r.cicloId,
          conceptoId: q.conceptoId,
          periodo: q.periodo,
          claveGeneracion: `REINSCRIPCION:${r.id}:${i}`,
          descripcion: `${q.nombre} · periodo ${r.periodoAcademicoId}`.slice(0, 200),
          monto: q.monto,
          descuento: q.descuento,
          recargo: 0,
          fechaVencimiento: q.fechaVencimiento,
          estatus: centavos(q.monto)===centavos(q.descuento)?'PAGADO':'PENDIENTE',
        }),
      );
      ids.push(cargo.id);
      await m.getRepository(BitacoraFinanciera).insert({
        usuarioId: u.sub,
        plantelId: r.plantelId,
        accion: 'REINSCRIPCION_CARGO',
        entidad: 'cargo',
        entidadId: cargo.id,
        detalle: `reinscripcion=${r.id}; autorizacion=${r.autorizacionId}; monto=${q.monto}; descuento=${q.descuento}`,
      });
    }
    await inscripciones.update(r.origenInscripcionId, { estatus: 'HISTORICA' });
    const destino = await inscripciones.save(
      inscripciones.create({ alumnoId: r.alumnoId, grupoId: g.id, estatus: 'ACTIVA' }),
    );
    await m.getRepository(ReinscripcionPeriodo).update(r.id, {
      estado: 'CONFIRMADA',
      grupoId: g.id,
      inscripcionDestinoId: destino.id,
      cargosJson: JSON.stringify(ids),
    });
    await m.getRepository(BitacoraAcademica).insert({
      usuarioId: u.sub,
      plantelId: r.plantelId,
      accion: 'REINSCRIPCION_CONFIRMADA',
      entidadId: r.id,
      detalle: `origen=${r.origenInscripcionId}; destino=${destino.id}; grupo=${g.id}; historial y recursamientos conservados`,
      fecha: new Date(),
    });
  }
  async prepararMixta(m: EntityManager, d: ContextoRegular, u: JwtUser, adicionalOrdinario: number): Promise<number[]> {
    const contexto = {
      plantelId: d.plantelId,
      cicloId: d.cicloId,
      nivelId: d.nivelId,
      carreraId: d.carreraId,
      periodoAcademicoId: d.periodoAcademicoId,
      turno: d.turno,
    };
    const solicitudes = await m
      .getRepository(SolicitudGrupoRegular)
      .find({ where: { ...contexto, estado: 'PENDIENTE' }, relations: { alumno: { usuario: true } } });
    const ordinarias = solicitudes.filter(
      (s) => s.alumno.estatus === 'ACTIVO' && s.alumno.usuario.activo && s.alumno.plantelId === s.plantelId,
    );
    const candidatas = await m
        .getRepository(ReinscripcionPeriodo)
        .find({ where: { ...contexto, estado: 'PENDIENTE' }, order: { id: 'ASC' } }),
      validas: ReinscripcionPeriodo[] = [];
    for (const r of candidatas) if (await this.origenVigente(m, r)) validas.push(r);
    const total = ordinarias.length + adicionalOrdinario + validas.length;
    if (!validas.length || validas.length >= 5 || total < 5) return [];
    const grupos = await m
      .getRepository(Grupo)
      .find({ where: { ...contexto, tipo: 'REGULAR', activo: true }, lock: { mode: 'pessimistic_write' } });
    for (const g of grupos)
      if (
        (await m.getRepository(Inscripcion).countBy({ grupoId: g.id, estatus: 'ACTIVA' })) <
        Math.min(50, await limiteRegulares(m, g.id))
      )
        return [];
    // Solo el remanente mixto de solicitudes sin grupo: no mueve inscripciones vivas.
    if (total > 50) return [];
    const grupo = await m.getRepository(Grupo).save({
      ...contexto,
      nombre: `MIXTA-${d.periodoAcademicoId}-${randomUUID().slice(0, 8)}`,
      tipo: 'REGULAR',
      activo: true,
    });
    for (const r of validas) await this.asignar(m, r, grupo, u);
    const asignadas = await this.agrupacion.completarCompatibles(m, d, u, [grupo.id]);
    await materializarAperturas(m, asignadas, u);
    const inscritos = await m.getRepository(Inscripcion).countBy({ grupoId: grupo.id, estatus: 'ACTIVA' });
    if (inscritos + adicionalOrdinario < 5)
      throw new ConflictException('Cambió la cohorte compartida; revisa solicitudes antes de asignar un grupo mínimo');
    return [grupo.id];
  }
  async completarCohorte(m: EntityManager, d: ContextoRegular, u: JwtUser) {
    const primera = await m.getRepository(ReinscripcionPeriodo).findOne({
      where: {
        plantelId: d.plantelId,
        cicloId: d.cicloId,
        nivelId: d.nivelId,
        carreraId: d.carreraId,
        periodoAcademicoId: d.periodoAcademicoId,
        turno: d.turno,
        estado: 'PENDIENTE',
      },
      order: { id: 'ASC' },
    });
    if (primera) await this.agrupar(m, primera, undefined, u);
  }
  private async agrupar(m: EntityManager, actual: ReinscripcionPeriodo, grupoId: number | undefined, u: JwtUser) {
    const contexto = {
        plantelId: actual.plantelId,
        cicloId: actual.cicloId,
        nivelId: actual.nivelId,
        carreraId: actual.carreraId,
        periodoAcademicoId: actual.periodoAcademicoId,
        turno: actual.turno,
      },
      repo = m.getRepository(ReinscripcionPeriodo),
      grupos = m.getRepository(Grupo);
    const compatibles = await grupos.find({
      where: { ...contexto, tipo: 'REGULAR', activo: true },
      order: { id: 'ASC' },
      lock: { mode: 'pessimistic_write' },
    });
    if (grupoId) {
      const g = compatibles.find((g) => g.id === grupoId);
      if (
        !g ||
        (await m.getRepository(Inscripcion).countBy({ grupoId: g.id, estatus: 'ACTIVA' })) >=
          Math.min(50, await limiteRegulares(m, g.id))
      )
        throw new ConflictException(
          'El grupo seleccionado ya no tiene cupo manual (máximo 50 y reservas por recursamiento)',
        );
      await this.asignar(m, actual, g, u);
      return;
    }
    const candidatas = await repo.find({ where: { ...contexto, estado: 'PENDIENTE' }, order: { id: 'ASC' } }),
      validas: ReinscripcionPeriodo[] = [];
    for (const r of candidatas) {
      if (await this.origenVigente(m, r)) validas.push(r);
      else {
        await repo.update(r.id, { estado: 'REQUIERE_REVISION' });
        await m.getRepository(BitacoraAcademica).insert({
          usuarioId: u.sub,
          plantelId: r.plantelId,
          accion: 'REINSCRIPCION_REQUIERE_REVISION',
          entidadId: r.id,
          detalle: 'Origen académico o plantel cambió antes de asignar grupo; sin cargos',
          fecha: new Date(),
        });
      }
    }
    const llenar = async (g: Grupo, limite: number) => {
      let total = await m.getRepository(Inscripcion).countBy({ grupoId: g.id, estatus: 'ACTIVA' });
      for (let i = 0; i < validas.length && total < limite;) {
        const r = validas[i];
        if (
          (await m.getRepository(Inscripcion).existsBy({ alumnoId: r.alumnoId, grupoId: g.id })) ||
          (await m
            .getRepository(ParticipacionAsignatura)
            .existsBy({ alumnoId: r.alumnoId, estado: 'ACTIVA', grupoMateria: { grupoId: g.id } }))
        ) {
          i++;
          continue;
        }
        await this.asignar(m, r, g, u);
        validas.splice(i, 1);
        total++;
      }
    };
    for (const g of compatibles) await llenar(g, Math.min(50, await limiteRegulares(m, g.id)));
    const plan = planificarGruposRegulares(validas.length);
    for (const cantidad of plan.grupos) {
      const g = await grupos.save(
        grupos.create({
          ...contexto,
          nombre: `REINS-${actual.periodoAcademicoId}-${randomUUID().slice(0, 8)}`,
          tipo: 'REGULAR',
          activo: true,
          programaEspecialId: null,
          cupoManual: null,
        }),
      );
      for (let n = 0; n < cantidad; n++) await this.asignar(m, validas.shift()!, g, u);
    }
    if (validas.length < 5)
      for (const g of compatibles) {
        const total = await m.getRepository(Inscripcion).countBy({ grupoId: g.id, estatus: 'ACTIVA' });
        if (total >= 50) await llenar(g, Math.min(54, await limiteRegulares(m, g.id)));
      }
  }
  async listar(q: ListarCarteraDto, u: JwtUser) {
    this.exigir(u, ['ADMINISTRATIVO', 'FINANZAS']);
    const planteles = await this.scope.resolverFiltro(u, q.plantelId);
    const qb = this.ds
      .getRepository(ReinscripcionPeriodo)
      .createQueryBuilder('r')
      .innerJoin('r.alumno', 'a')
      .innerJoin('a.usuario', 'u');
    if (planteles !== null) qb.andWhere('r.plantel_id IN (:...planteles)', { planteles });
    if (q.buscar) qb.andWhere(condicionBusquedaAlumno('a', 'u'), { buscar: `%${q.buscar}%` });
    const [rows, total] = await qb
      .orderBy('r.id', 'DESC')
      .skip((q.pagina - 1) * q.porPagina)
      .take(q.porPagina)
      .getManyAndCount();
    return { datos: rows.map((r) => this.recibo(r)), total, pagina: q.pagina, porPagina: q.porPagina };
  }
  async obtener(id: number, u: JwtUser) {
    this.exigir(u, ['ADMINISTRATIVO', 'FINANZAS']);
    const r = await this.ds.getRepository(ReinscripcionPeriodo).findOneBy({ id });
    if (!r) throw new NotFoundException('Reinscripción no encontrada');
    await this.scope.validarGestion(u, r.plantelId);
    return this.recibo(r);
  }
  async anular(id: number, d: AnularReinscripcionDto, u: JwtUser) {
    this.exigir(u, ['ADMINISTRATIVO']);
    const previa = await this.ds.getRepository(ReinscripcionPeriodo).findOneBy({ id });
    if (!previa) throw new NotFoundException('Reinscripción no encontrada');
    await this.scope.validarGestion(u, previa.plantelId);
    return this.tx(async (m) => {
      await m
        .getRepository(CicloEscolar)
        .findOne({ where: { id: previa.cicloId }, lock: { mode: 'pessimistic_read' } });
      await m.getRepository(Plantel).findOne({ where: { id: previa.plantelId }, lock: { mode: 'pessimistic_write' } });
      const repo = m.getRepository(ReinscripcionPeriodo),
        r = await repo.findOneOrFail({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (r.estado === 'ANULADA') return this.recibo(r);
      if (r.estado === 'CONFIRMADA')
        throw new ConflictException(
          'No se anula una reinscripción ya confirmada; usa una corrección auditada que preserve cargos e inscripciones',
        );
      await repo.update(id, { estado: 'ANULADA', claveOrigen: null });
      await m.getRepository(BitacoraAcademica).insert({
        usuarioId: u.sub,
        plantelId: r.plantelId,
        accion: 'REINSCRIPCION_ANULADA',
        entidadId: id,
        detalle: d.motivo,
        fecha: new Date(),
      });
      return this.recibo(await repo.findOneByOrFail({ id }));
    });
  }
}
