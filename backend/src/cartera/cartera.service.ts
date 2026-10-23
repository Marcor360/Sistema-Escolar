import { condicionBusquedaAlumno } from '../common/busqueda-alumno';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { DataSource, EntityManager, In } from 'typeorm';
import { Alumno, AperturaCartera, BitacoraFinanciera, Cargo, CicloEscolar, ConceptoPago, Grupo, Inscripcion, PeriodoAcademico, Plantel } from '../entities';
import { AgrupacionRegularService } from '../academico/agrupacion-regular.service';
import { validarContextoGrupo } from '../catalogos-academicos/contexto-grupo';
import { esConflictoTransaccional, esConflictoUnico } from '../academico/conflictos';
import { JwtUser } from '../common/current-user.decorator';
import { ScopeService } from '../planteles/scope.service';
import { ConfirmarCarteraDto, ConfirmarReinscripcionDto, ListarCarteraDto, PrevisualizarCarteraDto, PrevisualizarReinscripcionDto } from './cartera.dto';
const hash = (valor: unknown) => createHash('sha256').update(JSON.stringify(valor)).digest('hex');
@Injectable()
export class CarteraService {
  constructor(private readonly ds: DataSource, private readonly scope: ScopeService, private readonly agrupacion: AgrupacionRegularService) {}
  async trayectoria(alumnoId: number, u: JwtUser) {
    const alumno = await this.ds.getRepository(Alumno).findOneBy({ id: alumnoId });
    if (!alumno) throw new NotFoundException('Alumno no encontrado');
    await this.scope.validarGestion(u, alumno.plantelId);
    const inscripciones = await this.ds.getRepository(Inscripcion).find({
      where: { alumnoId, grupo: { tipo: 'REGULAR' } }, order: { id: 'DESC' }, take: 30,
    });
    const ultima = inscripciones
      .filter(i => i.grupo.periodoAcademicoId !== null)
      .sort((a,b) => b.grupo.ciclo.fechaInicio.localeCompare(a.grupo.ciclo.fechaInicio) || b.id-a.id)[0];
    if (!ultima) throw new ConflictException('El alumno aún no tiene periodo académico regular registrado');
    const periodo = await this.ds.getRepository(PeriodoAcademico).findOneBy({ id: ultima.grupo.periodoAcademicoId! });
    if (!periodo) throw new ConflictException('El periodo de origen no está registrado');
    return {
      alumno: { id: alumno.id, matricula: alumno.matricula, nombre: alumno.usuario.nombreCompleto, plantelId: alumno.plantelId },
      origen: { inscripcionId: ultima.id, grupo: ultima.grupo.nombre, cicloId: ultima.grupo.cicloId, nivelId: ultima.grupo.nivelId,
        carreraId: ultima.grupo.carreraId, periodoAcademicoId: periodo.id, periodo: periodo.nombre, tipo: periodo.tipo, numero: periodo.numero,
        turno: ultima.grupo.turno, fechaFin: ultima.grupo.ciclo.fechaFin },
      advertencia: 'Las calificaciones y materias pendientes requieren validación de Control Escolar; una reinscripción no las aprueba automáticamente.',
    };
  }
  private async validarReinscripcion(m: EntityManager, d: PrevisualizarReinscripcionDto, u: JwtUser) {
    if (!u.roles.some(r => ['ADMINISTRATIVO','FINANZAS','SUPERADMIN'].includes(r))) throw new ConflictException('Se requiere permiso de gestión para reinscribir');
    const alumno = await m.getRepository(Alumno).findOne({ where: { id: d.alumnoId }, lock: { mode: 'pessimistic_write' } });
    if (!alumno || alumno.estatus !== 'ACTIVO' || !alumno.usuario.activo || alumno.plantelId !== d.plantelId) throw new ConflictException('El alumno no está activo en ese plantel');
    await this.scope.validarGestion(u, d.plantelId);
    const origen = await m.getRepository(Inscripcion).findOne({ where: { id: d.origenInscripcionId, alumnoId: d.alumnoId } });
    if (!origen || origen.grupo.tipo !== 'REGULAR' || !origen.grupo.periodoAcademicoId) throw new ConflictException('La inscripción anterior no es válida');
    const destino = await m.getRepository(PeriodoAcademico).findOneBy({ id: d.periodoAcademicoId, cicloId: d.cicloId, carreraId: d.carreraId, plantelId: d.plantelId });
    const anterior = await m.getRepository(PeriodoAcademico).findOneBy({ id: origen.grupo.periodoAcademicoId });
    if (!destino?.activo || !anterior || !anterior.activo || destino.tipo !== anterior.tipo ||
      origen.grupo.carreraId !== d.carreraId || origen.grupo.nivelId !== d.nivelId || origen.grupo.plantelId !== d.plantelId)
      throw new ConflictException('El destino debe respetar el mismo nivel, plan y modalidad de periodo');
    const ciclo = await m.getRepository(CicloEscolar).findOneBy({ id: d.cicloId });
    if (!ciclo || origen.grupo.ciclo.estado !== 'CERRADO' || ciclo.estado !== 'PREPARACION')
      throw new ConflictException('La reinscripción exige ciclo de origen cerrado y ciclo de destino en preparación');
    if (ciclo.fechaInicio <= origen.grupo.ciclo.fechaFin)
      throw new ConflictException('El destino debe estar en un ciclo posterior al de origen; el cambio dentro del mismo ciclo necesita migración del historial académico');
    if ((destino.numero !== anterior.numero + 1) && (!d.motivo || d.motivo.trim().length < 10))
      throw new BadRequestException('El retroceso, repetición o salto requiere un motivo detallado de al menos 10 caracteres');
    if (d.ajustes?.length && !u.roles.some(r => ['FINANZAS','SUPERADMIN'].includes(r))) throw new BadRequestException('Solo Finanzas puede autorizar ajustes de colegiatura');
    if (d.ajustes?.length && d.ajustes.length > 10) throw new BadRequestException('Máximo 10 ajustes de tarifa por operación');
    return { origen, anterior, destino };
  }
  previsualizarReinscripcion(d: PrevisualizarReinscripcionDto, u: JwtUser) {
    return this.previsualizar(d, u);
  }
  confirmarReinscripcion(d: ConfirmarReinscripcionDto, u: JwtUser) {
    return this.confirmar(d, u);
  }

  private async cotizar(m: EntityManager, d: PrevisualizarCarteraDto, u: JwtUser) {
    await this.scope.validarGestion(u, d.plantelId);
    const pl = await m.getRepository(Plantel).findOne({ where: { id: d.plantelId }, lock: { mode: 'pessimistic_write' } });
    const ciclo = await m.getRepository(CicloEscolar).findOneBy({ id: d.cicloId });
    if (!pl?.activo || !ciclo || !['PREPARACION','ACTIVO'].includes(ciclo.estado)) throw new ConflictException('Plantel y ciclo no disponibles');
    await validarContextoGrupo(m, d);
    if ('origenInscripcionId' in d) await this.validarReinscripcion(m, d as PrevisualizarReinscripcionDto, u);
    const a = await m.getRepository(Alumno).findOneBy({ id: d.alumnoId, plantelId: d.plantelId });
    if (!a || a.estatus !== 'ACTIVO' || !a.usuario.activo) throw new ConflictException('Selecciona un alumno activo del plantel');
    if (d.grupoId) {
      const grupo = await m.getRepository(Grupo).findOneBy({ id: d.grupoId, plantelId: d.plantelId, cicloId: d.cicloId, nivelId: d.nivelId, carreraId: d.carreraId, periodoAcademicoId: d.periodoAcademicoId, turno: d.turno, tipo: 'REGULAR', activo: true });
      if (!grupo) throw new ConflictException('El grupo seleccionado no coincide con el contexto ordinario');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.fechaVencimiento) || d.fechaVencimiento < ciclo.fechaInicio || d.fechaVencimiento > ciclo.fechaFin || d.periodo < ciclo.fechaInicio.slice(0,7) || d.periodo > ciclo.fechaFin.slice(0,7)) throw new BadRequestException('Periodo de cobro y vencimiento deben estar dentro del ciclo');
    const conceptos = await m.getRepository(ConceptoPago).find({ where: { id: In(d.conceptoIds), activo: true }, order: { id: 'ASC' }, lock: { mode: 'pessimistic_read' } });
    if (conceptos.length !== d.conceptoIds.length || conceptos.some(c => ['BECA','DESCUENTO','RECARGO'].includes(c.tipo) || c.montoBase <= 0)) throw new ConflictException('Selecciona conceptos de cobro activos con tarifa positiva definida por Finanzas');
    if (conceptos.filter(c => c.tipo === 'COLEGIATURA').length > 1) throw new ConflictException('Selecciona una sola colegiatura por mes');
    const ajustes = 'ajustes' in d ? (d as PrevisualizarReinscripcionDto).ajustes ?? [] : [];
    if (ajustes.some(a => !conceptos.some(c => c.id === a.conceptoId && c.tipo === 'COLEGIATURA')))
      throw new BadRequestException('Los ajustes autorizados solo aplican a la colegiatura seleccionada');
    const precios = conceptos.map(c => ({ conceptoId: c.id, clave: c.clave, nombre: c.nombre, tipo: c.tipo,
      monto: ajustes.find(a => a.conceptoId === c.id)?.monto ?? c.montoBase,
      periodo: d.periodo, fechaVencimiento: d.fechaVencimiento }));
    const contexto = { alumnoId: d.alumnoId, plantelId: d.plantelId, cicloId: d.cicloId, nivelId: d.nivelId, carreraId: d.carreraId, periodoAcademicoId: d.periodoAcademicoId, turno: d.turno, grupoId: d.grupoId ?? null, ...('origenInscripcionId' in d ? { origenInscripcionId: (d as PrevisualizarReinscripcionDto).origenInscripcionId, motivo: (d as PrevisualizarReinscripcionDto).motivo ?? null, ajustes } : {}) };
    return { conceptos: precios, total: Math.round(precios.reduce((n,c) => n+c.monto, 0)*100)/100, cotizacion: hash({ contexto, precios }), contexto };
  }
  previsualizar(d: PrevisualizarCarteraDto, u: JwtUser) { return this.ds.transaction('READ COMMITTED', m => this.cotizar(m, d, u)); }
  private proyectar(a: AperturaCartera) { return { id: a.id, alumnoId: a.alumnoId, matricula: a.alumno?.matricula ?? null, nombreAlumno: a.alumno?.usuario?.nombreCompleto ?? null, total: Math.round(a.conceptos.reduce((sum,c) => sum + c.monto,0)*100)/100, plantelId: a.plantelId, cicloId: a.cicloId, estado: a.solicitud?.estado === 'ANULADA' ? 'REQUIERE_REVISION' : a.estado, grupoId: a.solicitud?.grupoId ?? null, solicitudId: a.solicitudId, conceptos: a.conceptos, fecha: a.createdAt }; }
  async confirmar(d: ConfirmarCarteraDto, u: JwtUser) {
    const peticionHash = hash({ ...d, conceptoIds: [...d.conceptoIds].sort((a,b) => a-b) });
    try {
      return await this.ds.transaction('READ COMMITTED', async m => {
        await this.scope.validarGestion(u, d.plantelId);
        await m.getRepository(Plantel).findOne({ where: { id: d.plantelId }, lock: { mode: 'pessimistic_write' } });
        const repo = m.getRepository(AperturaCartera);
        const previa = await repo.findOne({ where: { idempotencia: d.idempotencia }, relations: { solicitud: true } });
        if (previa) {
          if (previa.peticionHash !== peticionHash || previa.creadoPorId !== u.sub) throw new ConflictException('La clave de idempotencia ya corresponde a otra confirmación');
          await this.scope.validarGestion(u, previa.plantelId); return this.proyectar(previa);
        }
        if (await repo.existsBy({ alumnoId: d.alumnoId, cicloId: d.cicloId })) throw new ConflictException('El alumno ya tiene apertura de cartera en este ciclo');
        const precio = await this.cotizar(m, d, u);
        if (d.cotizacion !== precio.cotizacion) throw new ConflictException('La cotización cambió; vuelve a previsualizar y confirmar');
        const apertura = await repo.save(repo.create({ idempotencia: d.idempotencia, peticionHash, alumnoId: d.alumnoId, plantelId: d.plantelId, cicloId: d.cicloId, creadoPorId: u.sub, estado: 'PENDIENTE', conceptos: precio.conceptos, solicitudId: null }));
        const resultado = await this.agrupacion.solicitar(m, d, u, 'origenInscripcionId' in d);
        await repo.update(apertura.id, { solicitudId: resultado.solicitud.id });
        const asignadas = resultado.asignadas.length ? await repo.find({ where: { solicitudId: In(resultado.asignadas) }, order: { id: 'ASC' } }) : [];
        for (const a of asignadas) {
          const cargos = m.getRepository(Cargo);
          for (const c of a.conceptos) {
            const claveGeneracion = c.tipo === 'COLEGIATURA' ? `COLEGIATURA:${a.cicloId}:${a.alumnoId}:${c.periodo}` : `APERTURA:${a.id}:${c.conceptoId}`;
            const existente = await cargos.findOneBy({ alumnoId: a.alumnoId, cicloId: a.cicloId, conceptoId: c.conceptoId, periodo: c.periodo });
            if (existente) {
              if (existente.estatus === 'CANCELADO' || existente.monto !== c.monto || existente.claveGeneracion !== claveGeneracion) throw new ConflictException('Existe un cargo previo incompatible; Finanzas debe revisarlo sin duplicarlo');
              c.cargoId = existente.id;
            } else {
              const cargo = await cargos.save(cargos.create({ plantelId: a.plantelId, alumnoId: a.alumnoId, cicloId: a.cicloId, conceptoId: c.conceptoId, periodo: c.periodo, claveGeneracion, descripcion: c.nombre, monto: c.monto, descuento: 0, recargo: 0, fechaVencimiento: c.fechaVencimiento, estatus: 'PENDIENTE' }));
              c.cargoId = cargo.id;
              await m.getRepository(BitacoraFinanciera).insert({ usuarioId: u.sub, plantelId: a.plantelId, accion: 'APERTURA_CARGO', entidad: 'cargo', entidadId: cargo.id, detalle: `aperturaId=${a.id}; monto autorizado=${c.monto}` });
            }
          }
          await repo.update(a.id, { estado: 'ABIERTA', conceptos: a.conceptos });
        }
        await m.getRepository(BitacoraFinanciera).insert({ usuarioId: u.sub, plantelId: d.plantelId, accion: 'APERTURA_CARTERA', entidad: 'apertura', entidadId: apertura.id, detalle: `solicitudId=${resultado.solicitud.id}; cotizacion=${precio.cotizacion}${'origenInscripcionId' in d ? `; reinscripcionOrigen=${(d as ConfirmarReinscripcionDto).origenInscripcionId}; motivo=${(d as ConfirmarReinscripcionDto).motivo ?? 'AVANCE'}; ajustes=${JSON.stringify((d as ConfirmarReinscripcionDto).ajustes ?? [])}` : ''}`.slice(0, 500) });
        return this.proyectar(await repo.findOneOrFail({ where: { id: apertura.id }, relations: { solicitud: true } }));
      });
    } catch (e) { if (esConflictoUnico(e) || esConflictoTransaccional(e)) throw new ConflictException('La apertura cambió concurrentemente; consulta el resultado y reintenta con la misma clave'); throw e; }
  }
  async listar(q: ListarCarteraDto, u: JwtUser) {
    const planteles = await this.scope.resolverFiltro(u, q.plantelId);
    const qb = this.ds.getRepository(AperturaCartera).createQueryBuilder('a').leftJoinAndSelect('a.solicitud','s').innerJoinAndSelect('a.alumno','al').innerJoinAndSelect('al.usuario','u');
    if (planteles !== null) qb.andWhere('a.plantel_id IN (:...planteles)', { planteles });
    if (q.buscar) qb.andWhere(condicionBusquedaAlumno('al', 'u'), { buscar: `%${q.buscar}%` });
    const [filas,total] = await qb.orderBy('a.id','DESC').skip((q.pagina-1)*q.porPagina).take(q.porPagina).getManyAndCount();
    return { datos: filas.map(a => this.proyectar(a)), total, pagina: q.pagina, porPagina: q.porPagina };
  }
  async obtener(id: number, u: JwtUser) {
    const a = await this.ds.getRepository(AperturaCartera).findOne({ where: { id }, relations: { solicitud: true, alumno: { usuario: true } } });
    if (!a) throw new NotFoundException('Apertura no encontrada'); await this.scope.validarGestion(u, a.plantelId); return this.proyectar(a);
  }
}
