import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, EntityTarget } from 'typeorm';
import { BitacoraAcademica, CarreraPlan, CicloEscolar, Grupo, NivelAcademico, PeriodoAcademico, Plantel } from '../entities';
import { JwtUser } from '../common/current-user.decorator';
import { exigirCambios } from '../common/exigir-cambios';
import { ScopeService } from '../planteles/scope.service';
import { esConflictoUnico, esConflictoTransaccional } from '../academico/conflictos';
import { CrearCarreraDto, CrearNivelDto, CrearPeriodoDto, EditarCatalogoDto, EditarPeriodoDto, ListarCatalogosDto } from './catalogos.dto';

export type TipoCatalogo = 'niveles' | 'carreras' | 'periodos';
interface RegistroCatalogo {
  id: number; plantelId: number; clave: string; nombre: string; activo: boolean;
  nivelId?: number; carreraId?: number; cicloId?: number; versionPlan?: string;
  fechaInicio?:string|null; fechaFin?:string|null;
  tipo?: 'ANUAL' | 'SEMESTRAL' | 'CUATRIMESTRAL'; numero?: number;
}
const entidades: Record<TipoCatalogo, EntityTarget<RegistroCatalogo>> = { niveles: NivelAcademico, carreras: CarreraPlan, periodos: PeriodoAcademico };
@Injectable()
export class CatalogosAcademicosService {
  constructor(private readonly ds: DataSource, private readonly scope: ScopeService) {}
  async listar(tipo: TipoCatalogo, q: ListarCatalogosDto, user: JwtUser) {
    const planteles = await this.scope.resolverFiltro(user, q.plantelId);
    const qb = this.ds.getRepository(entidades[tipo]).createQueryBuilder('c');
    if (planteles !== null) qb.andWhere('c.plantel_id IN (:...planteles)', { planteles });
    if (q.inactivos !== 'true') qb.andWhere('c.activo = :activo', { activo: true });
    if (q.buscar?.trim()) qb.andWhere('(c.clave LIKE :buscar OR c.nombre LIKE :buscar)', { buscar: `%${q.buscar.trim()}%` });
    if (tipo === 'carreras' && q.nivelId) qb.andWhere('c.nivel_id = :nivelId', { nivelId: q.nivelId });
    if (tipo === 'periodos') {
      if (q.carreraId) qb.andWhere('c.carrera_id = :carreraId', { carreraId: q.carreraId });
      if (q.cicloId) qb.andWhere('c.ciclo_id = :cicloId', { cicloId: q.cicloId });
    }
    const [datos, total] = await qb.orderBy('c.clave', 'ASC').addOrderBy('c.id', 'ASC').skip((q.pagina - 1) * q.porPagina).take(q.porPagina).getManyAndCount();
    return { datos, total, pagina: q.pagina, porPagina: q.porPagina };
  }
  async obtener(tipo: TipoCatalogo, id: number, user: JwtUser) {
    const fila = await this.ds.getRepository(entidades[tipo]).findOneBy({ id });
    if (!fila) throw new NotFoundException('Registro de catálogo no encontrado');
    await this.scope.validarGestion(user, fila.plantelId);
    return fila;
  }
  private async validarFechas(m:EntityManager,cicloId:number,inicio?:string|null,fin?:string|null) {
    if(!inicio&&!fin)return;
    const ciclo=await m.getRepository(CicloEscolar).findOneByOrFail({id:cicloId});
    if(!inicio||!fin||!/^\d{4}-\d{2}-\d{2}$/.test(inicio)||!/^\d{4}-\d{2}-\d{2}$/.test(fin)||inicio>fin||inicio<ciclo.fechaInicio||fin>ciclo.fechaFin)throw new ConflictException('Indica inicio y fin reales del periodo dentro de las fechas del ciclo');
  }
  async crear(tipo: TipoCatalogo, dto: CrearNivelDto | CrearCarreraDto | CrearPeriodoDto, user: JwtUser) {
    await this.scope.validarGestion(user, dto.plantelId);
    return this.operar(async () => this.ds.transaction(async (m) => {
      const plantel = await m.getRepository(Plantel).findOne({ where: { id: dto.plantelId }, lock: { mode: 'pessimistic_write' } });
      if (!plantel?.activo) throw new ConflictException('Selecciona un plantel activo');
      if (tipo === 'carreras') {
        const d = dto as CrearCarreraDto;
        const nivel = await m.getRepository(NivelAcademico).findOneBy({ id: d.nivelId, plantelId: d.plantelId, activo: true });
        if (!nivel) throw new ConflictException('El nivel no está activo en este plantel');
      }
      if (tipo === 'periodos') {
        const d = dto as CrearPeriodoDto;
        const carrera = await m.getRepository(CarreraPlan).findOneBy({ id: d.carreraId, plantelId: d.plantelId, activo: true });
        const nivel = carrera && await m.getRepository(NivelAcademico).findOneBy({ id: carrera.nivelId, activo: true });
        const ciclo = await m.getRepository(CicloEscolar).findOneBy({ id: d.cicloId });
        if (!carrera || !nivel || !ciclo || !['PREPARACION', 'ACTIVO'].includes(ciclo.estado)) throw new ConflictException('Selecciona carrera/plan y ciclo activos o en preparación');
      }
      if(tipo==='periodos') { const d=dto as CrearPeriodoDto; await this.validarFechas(m,d.cicloId,d.fechaInicio,d.fechaFin); }
      const repo = m.getRepository(entidades[tipo]);
      const registro = await repo.save(repo.create({ ...dto, activo: true }));
      await m.getRepository(BitacoraAcademica).insert({ usuarioId: user.sub, plantelId: dto.plantelId, accion: 'CATALOGO_CREADO', entidadId: registro.id, detalle: `tipo=${tipo}`, fecha: new Date() });
      return registro;
    }));
  }
  async editar(tipo: TipoCatalogo, id: number, dto: EditarCatalogoDto | EditarPeriodoDto, user: JwtUser) {
    exigirCambios(dto);
    const actual = await this.ds.getRepository(entidades[tipo]).findOneBy({ id });
    if (!actual) throw new NotFoundException('Registro de catálogo no encontrado');
    await this.scope.validarGestion(user, actual.plantelId);
    return this.operar(async () => this.ds.transaction(async (m) => {
      await m.getRepository(Plantel).findOne({ where: { id: actual.plantelId }, lock: { mode: 'pessimistic_write' } });
      const repo = m.getRepository(entidades[tipo]);
      const fila = await repo.findOneOrFail({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if(tipo==='periodos' && fila.cicloId) { const d=dto as EditarPeriodoDto; await this.validarFechas(m,fila.cicloId,d.fechaInicio??fila.fechaInicio,d.fechaFin??fila.fechaFin); }
      if (dto.activo === false) {
        const campo = tipo === 'niveles' ? 'nivelId' : tipo === 'carreras' ? 'carreraId' : 'periodoAcademicoId';
        if (await m.getRepository(Grupo).existsBy({ [campo]: id, activo: true })) throw new ConflictException('El catálogo está usado por grupos activos');
        if (tipo === 'niveles' && await m.getRepository(CarreraPlan).existsBy({ nivelId: id, activo: true })) throw new ConflictException('Desactiva primero las carreras/planes del nivel');
        if (tipo === 'carreras' && await m.getRepository(PeriodoAcademico).existsBy({ carreraId: id, activo: true })) throw new ConflictException('Desactiva primero los periodos de la carrera/plan');
      }
      if (dto.activo === true && !fila.activo) {
        if (tipo === 'carreras' && !await m.getRepository(NivelAcademico).existsBy({ id: fila.nivelId, activo: true })) throw new ConflictException('Activa primero el nivel');
        if (tipo === 'periodos' && !await m.getRepository(CarreraPlan).existsBy({ id: fila.carreraId, activo: true })) throw new ConflictException('Activa primero la carrera/plan');
      }
      Object.assign(fila, dto);
      const guardada = await repo.save(fila);
      await m.getRepository(BitacoraAcademica).insert({ usuarioId: user.sub, plantelId: fila.plantelId, accion: 'CATALOGO_EDITADO', entidadId: id, detalle: `tipo=${tipo}; activo=${guardada.activo}`, fecha: new Date() });
      return guardada;
    }));
  }
  private async operar<T>(fn: () => Promise<T>) {
    try { return await fn(); } catch (error) {
      if (esConflictoUnico(error)) throw new ConflictException('Ya existe esa clave o periodo en el contexto seleccionado');
      if (esConflictoTransaccional(error)) throw new ConflictException('El catálogo cambió al mismo tiempo; vuelve a consultar');
      throw error;
    }
  }
}
