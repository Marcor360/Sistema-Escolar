import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConceptoPago } from '../entities/concepto-pago.entity';
import { ConceptoDto } from './finanzas.dto';

/** Única responsabilidad: catálogo de conceptos de cobro. */
@Injectable()
export class ConceptosService {
  constructor(
    @InjectRepository(ConceptoPago)
    private readonly repo: Repository<ConceptoPago>,
  ) {}

  listar() {
    return this.repo.find({ where: { activo: true }, order: { clave: 'ASC' } });
  }

  crear(dto: ConceptoDto) {
    return this.repo.save(this.repo.create(dto));
  }

  async actualizar(id: number, dto: Partial<ConceptoDto>) {
    await this.repo.update(id, dto);
    return this.repo.findOne({ where: { id } });
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
