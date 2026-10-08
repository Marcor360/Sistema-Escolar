import { exigirCambios } from '../common/exigir-cambios';
import { esConflictoUnico } from '../academico/conflictos';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConceptoPago } from '../entities/concepto-pago.entity';
import { ActualizarConceptoDto, ConceptoDto } from './finanzas.dto';

/** Única responsabilidad: catálogo de conceptos de cobro. */
@Injectable()
export class ConceptosService {
  constructor(
    @InjectRepository(ConceptoPago)
    private readonly repo: Repository<ConceptoPago>,
  ) {}

  listar(incluirInactivos = false) {
    return this.repo.find({ where: incluirInactivos ? {} : { activo: true }, order: { clave: 'ASC' } });
  }

  async crear(dto: ConceptoDto) {
    this.validarTipo(dto.tipo);
    try { return await this.repo.save(this.repo.create(dto)); }
    catch (error) { if (esConflictoUnico(error)) throw new ConflictException('La clave de concepto ya está registrada'); throw error; }
  }

  async actualizar(id: number, dto: ActualizarConceptoDto) {
    await this.obtener(id);
    if (dto.tipo) this.validarTipo(dto.tipo);
    exigirCambios(dto);
    try { await this.repo.update(id, dto); }
    catch (error) { if (esConflictoUnico(error)) throw new ConflictException('La clave de concepto ya está registrada'); throw error; }
    return this.repo.findOne({ where: { id } });
  }

  private validarTipo(tipo: string) {
    if (['BECA', 'DESCUENTO', 'RECARGO'].includes(tipo)) throw new BadRequestException('Los descuentos se aplican al cargo y los recargos mediante su política; no son conceptos de cobro');
  }

  async porClave(clave: string) {
    const concepto = await this.repo.findOne({ where: { clave } });
    if (!concepto) throw new NotFoundException(`Falta el concepto ${clave} en el catálogo`);
    return concepto;
  }

  async obtener(id: number) {
    const concepto = await this.repo.findOne({ where: { id } });
    if (!concepto) throw new NotFoundException('Concepto no encontrado');
    return concepto;
  }
}
