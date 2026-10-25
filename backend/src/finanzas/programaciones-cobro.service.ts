import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { DataSource, EntityManager, In } from 'typeorm';
import { Alumno, BitacoraFinanciera, Cargo, CicloEscolar, ConceptoPago, Inscripcion, PeriodoAcademico, Plantel, ProgramacionCobro } from '../entities';
import { JwtUser } from '../common/current-user.decorator';
import { ScopeService } from '../planteles/scope.service';
import { ConfirmarProgramacionDto, CuotaProgramada } from './programaciones-persistidas.dto';
import { previsualizarProgramacion } from './programaciones';

const hash = (valor: ConfirmarProgramacionDto) => createHash('sha256')
  .update(JSON.stringify(Object.fromEntries(Object.entries(valor).sort(([a], [b]) => a.localeCompare(b))))).digest('hex');

@Injectable()
export class ProgramacionesCobroService {
  constructor(private readonly dataSource: DataSource, private readonly scope: ScopeService) {}

  private async validarInscripcion(m: EntityManager, alumnoId: number, plantelId: number, cicloId: number, periodoAcademicoId: number) {
    const valida = await m.getRepository(Inscripcion).existsBy({
      alumnoId, estatus: 'ACTIVA', grupo: {
        plantelId, cicloId, periodoAcademicoId, tipo: 'REGULAR', activo: true,
      },
    });
    if (!valida) throw new ConflictException('Debes confirmar primero la inscripción regular y el grupo del periodo; no se cargan periodos académicos pendientes');
  }

  private presentar(plan: ProgramacionCobro) {
    return { id: plan.id, alumnoId: plan.alumnoId, plantelId: plan.plantelId, cicloId: plan.cicloId,
      periodoAcademicoId: plan.periodoAcademicoId, conceptoId: plan.conceptoId,
      modalidad: plan.modalidad, total: plan.total, cuotas: plan.cuotas, fecha: plan.createdAt };
  }

  async obtener(id: number, user: JwtUser) {
    const plan = await this.dataSource.getRepository(ProgramacionCobro).findOneBy({ id });
    if (!plan) throw new NotFoundException('Programación no encontrada');
    await this.scope.validarGestion(user, plan.plantelId);
    return this.presentar(plan);
  }

  async confirmar(dto: ConfirmarProgramacionDto, user: JwtUser) {
    const peticionHash = hash(dto);
    const calculo = previsualizarProgramacion(dto);
    return this.dataSource.transaction('READ COMMITTED', async manager => {
      await this.scope.validarGestion(user, dto.plantelId);
      // Mismo primer lock que el generador masivo y el cierre académico.
      const ciclo = await manager.getRepository(CicloEscolar).findOne({
        where: { id: dto.cicloId }, lock: { mode: 'pessimistic_write' },
      });
      const plantel = await manager.getRepository(Plantel).findOne({
        where: { id: dto.plantelId, activo: true }, lock: { mode: 'pessimistic_write' },
      });
      if (!plantel) throw new ConflictException('El plantel no está activo');
      const repo = manager.getRepository(ProgramacionCobro);
      const previa = await repo.findOneBy({ idempotencia: dto.idempotencia });
      if (previa) {
        if (previa.creadoPorId !== user.sub || previa.peticionHash !== peticionHash || previa.plantelId !== dto.plantelId) {
          throw new ConflictException('La idempotencia pertenece a otra operación');
        }
        return this.presentar(previa);
      }
      if (!ciclo || !['ACTIVO', 'PREPARACION'].includes(ciclo.estado)) throw new ConflictException('El ciclo no admite nuevos cobros');
      if (await repo.existsBy({
        alumnoId: dto.alumnoId, cicloId: dto.cicloId,
        periodoAcademicoId: dto.periodoAcademicoId, conceptoId: dto.conceptoId,
      })) throw new ConflictException('Ya existe una programación con el concepto y periodo seleccionados');

      const alumno = await manager.getRepository(Alumno).findOneBy({ id: dto.alumnoId, plantelId: dto.plantelId });
      if (!alumno || alumno.estatus !== 'ACTIVO' || !alumno.usuario.activo) {
        throw new ConflictException('El alumno no está activo en el plantel');
      }
      const origen = await manager.getRepository(PeriodoAcademico).findOneBy({
        id: dto.periodoAcademicoId, plantelId: dto.plantelId, cicloId: dto.cicloId, activo: true,
      });
      if (!origen) throw new ConflictException('Selecciona un periodo académico válido para el ciclo y plantel');
      const esperada = { SECUNDARIA: 'ANUAL', BACHILLERATO: 'SEMESTRAL', SUPERIOR: 'CUATRIMESTRAL' } as const;
      if (dto.modalidad !== 'ADICIONAL' && origen.tipo !== esperada[dto.modalidad]) {
        throw new BadRequestException('La modalidad de pago no coincide con el periodo académico del plan');
      }
      if (dto.modalidad !== 'BACHILLERATO' && dto.segundoPeriodoAcademicoId !== undefined) {
        throw new BadRequestException('El segundo periodo solo se utiliza para Bachillerato');
      }
      const concepto = await manager.getRepository(ConceptoPago).findOneBy({ id: dto.conceptoId, activo: true });
      if (!concepto || ['BECA', 'DESCUENTO', 'RECARGO'].includes(concepto.tipo)) throw new ConflictException('El concepto financiero no está disponible');
      if (dto.modalidad === 'SECUNDARIA' && !['OTRO', 'COLEGIATURA'].includes(concepto.tipo)) throw new ConflictException('La anualidad requiere un concepto OTRO o COLEGIATURA');
      if (dto.modalidad === 'ADICIONAL' && concepto.tipo !== 'OTRO') throw new ConflictException('Un servicio adicional requiere un concepto de tipo OTRO');
      if (['BACHILLERATO', 'SUPERIOR'].includes(dto.modalidad) && concepto.tipo !== 'COLEGIATURA') {
        throw new ConflictException('Para semestres y cuatrimestres el concepto debe ser COLEGIATURA');
      }
      await this.validarInscripcion(manager, dto.alumnoId, dto.plantelId, dto.cicloId, origen.id);
      let segundoPeriodo: PeriodoAcademico | null = null;
      if (dto.modalidad === 'BACHILLERATO') {
        if (!dto.segundoPeriodoAcademicoId) throw new BadRequestException('Indica el periodo académico del segundo semestre');
        segundoPeriodo = await manager.getRepository(PeriodoAcademico).findOneBy({
          id: dto.segundoPeriodoAcademicoId, plantelId: dto.plantelId, cicloId: dto.cicloId,
          carreraId: origen.carreraId, tipo: 'SEMESTRAL', numero: origen.numero + 1, activo: true,
        });
        if (!segundoPeriodo) throw new ConflictException('El segundo semestre debe ser consecutivo y del mismo plan/ciclo; otro ciclo requiere nueva gestión académica');
      }
      const cuotas: CuotaProgramada[] = calculo.cuotas.map((c, indice) => ({
        ...c, periodoAcademicoId: indice === 1 && segundoPeriodo ? segundoPeriodo.id : origen.id, cargoId: null,
      }));
      if (cuotas.some(c => c.fechaVencimiento < ciclo.fechaInicio || c.fechaVencimiento > ciclo.fechaFin)) {
        throw new ConflictException('Todas las fechas de cobro deben estar dentro de la vigencia del ciclo escolar');
      }
      const plan = await repo.save(repo.create({
        idempotencia: dto.idempotencia, peticionHash, alumnoId: alumno.id,
        plantelId: dto.plantelId, cicloId: dto.cicloId,
        periodoAcademicoId: origen.id, conceptoId: concepto.id, modalidad: dto.modalidad,
        total: calculo.total, cuotas, creadoPorId: user.sub,
      }));
      await manager.getRepository(BitacoraFinanciera).insert({
        usuarioId: user.sub, plantelId: dto.plantelId, accion: 'PROGRAMAR_COBROS',
        entidad: 'programacion_cobro', entidadId: plan.id,
        detalle: 'Total autorizado $' + calculo.total.toFixed(2) + '; cuotas=' + cuotas.length,
      });
      return this.presentar(plan);
    });
  }

  async emitir(id: number, numero: number, user: JwtUser) {
    if (!Number.isSafeInteger(numero) || numero <= 0 || numero > 12) throw new BadRequestException('Número de cuota inválido');
    return this.dataSource.transaction('READ COMMITTED', async manager => {
      const repo = manager.getRepository(ProgramacionCobro);
      const anterior = await repo.findOneBy({ id });
      if (!anterior) throw new NotFoundException('Programación no encontrada');
      await this.scope.validarGestion(user, anterior.plantelId);
      const ciclo = await manager.getRepository(CicloEscolar).findOne({ where: { id: anterior.cicloId }, lock: { mode: 'pessimistic_write' } });
      const plantel = await manager.getRepository(Plantel).findOne({
        where: { id: anterior.plantelId, activo: true }, lock: { mode: 'pessimistic_write' },
      });
      if (!plantel) throw new ConflictException('Plantel no disponible');
      const plan = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!plan) throw new NotFoundException('Programación no encontrada');
      const cuota = plan.cuotas.find(c => c.numero === numero);
      if (!cuota) throw new NotFoundException('La cuota no existe');
      if (cuota.cargoId) return { cargoId: cuota.cargoId, identificador: 'IUA-C' + String(cuota.cargoId).padStart(10, '0'), duplicado: true };
      if (!ciclo || ciclo.estado !== 'ACTIVO') throw new ConflictException('Para emitir un cargo, el ciclo debe estar ACTIVO');
      const alumno = await manager.getRepository(Alumno).findOne({ where: { id: plan.alumnoId, plantelId: plan.plantelId }, lock: { mode: 'pessimistic_write' } });
      if (!alumno || alumno.estatus !== 'ACTIVO' || !alumno.usuario.activo) throw new ConflictException('Alumno no disponible');
      const periodo = await manager.getRepository(PeriodoAcademico).findOneBy({ id: cuota.periodoAcademicoId, plantelId: plan.plantelId, cicloId: plan.cicloId, activo: true });
      if (!periodo) throw new ConflictException('El periodo académico ya no está activo');
      await this.validarInscripcion(manager, plan.alumnoId, plan.plantelId, plan.cicloId, cuota.periodoAcademicoId);
      const concepto = await manager.getRepository(ConceptoPago).findOneBy({ id: plan.conceptoId, activo: true });
      if (!concepto) throw new ConflictException('El concepto fue desactivado; Finanzas debe revisar');
      if ((['BACHILLERATO', 'SUPERIOR'].includes(plan.modalidad) && concepto.tipo !== 'COLEGIATURA') ||
          (plan.modalidad === 'ADICIONAL' && concepto.tipo !== 'OTRO') ||
          (plan.modalidad === 'SECUNDARIA' && !['OTRO', 'COLEGIATURA'].includes(concepto.tipo))) {
        throw new ConflictException('El tipo del concepto cambió; Finanzas debe revisar la programación');
      }
      const cargos = manager.getRepository(Cargo);
      const clave = 'PROGRAMACION:' + plan.id + ':' + numero;
      const porClave = await cargos.findOneBy({ claveGeneracion: clave });
      if (porClave) throw new ConflictException('Existe el cargo programado sin conciliación con la ficha; revisa su bitácora');
      const condiciones = {
        alumnoId: plan.alumnoId, cicloId: plan.cicloId, periodo: cuota.periodo,
        estatus: In(['PENDIENTE', 'PARCIAL', 'PAGADO', 'VENCIDO'] as const),
      };
      const colision = concepto.tipo === 'COLEGIATURA'
        ? await cargos.findOne({ where: { ...condiciones, concepto: { tipo: 'COLEGIATURA' } } })
        : await cargos.findOne({ where: { ...condiciones, conceptoId: concepto.id } });
      if (colision) throw new ConflictException('Ya existe un cargo compatible en ese mes; no se permiten dobles cobros');
      const cargo = await cargos.save(cargos.create({
        plantelId: plan.plantelId, alumnoId: plan.alumnoId, cicloId: plan.cicloId,
        conceptoId: plan.conceptoId, claveGeneracion: clave, periodo: cuota.periodo,
        descripcion: concepto.nombre + ' · ' + cuota.etiqueta,
        monto: cuota.monto, descuento: 0, recargo: 0, fechaVencimiento: cuota.fechaVencimiento,
        estatus: 'PENDIENTE',
      }));
      plan.cuotas = plan.cuotas.map(c => c.numero === numero ? { ...c, cargoId: cargo.id } : c);
      await repo.save(plan);
      await manager.getRepository(BitacoraFinanciera).insert({
        usuarioId: user.sub, plantelId: plan.plantelId, accion: 'PROGRAMACION_EMITIR',
        entidad: 'cargo', entidadId: cargo.id, detalle: 'programacionId=' + plan.id + '; cuota=' + numero,
      });
      return { cargoId: cargo.id, identificador: 'IUA-C' + String(cargo.id).padStart(10, '0'), duplicado: false };
    });
  }
}
