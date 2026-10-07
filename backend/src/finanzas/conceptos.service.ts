import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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

  crear(dto: ConceptoDto) {
    this.validarTipo(dto.tipo);
    return this.repo.save(this.repo.create(dto));
  }

  async actualizar(id: number, dto: ActualizarConceptoDto) {
    await this.obtener(id);
    if (dto.tipo) this.validarTipo(dto.tipo);
    await this.repo.update(id, dto);
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
