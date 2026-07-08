import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BitacoraFinanciera } from '../entities/bitacora-financiera.entity';

/** Única responsabilidad: registrar y consultar movimientos financieros. */
@Injectable()
export class BitacoraFinancieraService {
  constructor(
    @InjectRepository(BitacoraFinanciera)
    private readonly repo: Repository<BitacoraFinanciera>,
  ) {}

  registrar(usuarioId: number | null, accion: string, entidad: string, entidadId: number | null, detalle: string) {
    return this.repo.insert({ usuarioId, accion, entidad, entidadId, detalle: detalle.slice(0, 500) });
  }

  listar() {
    return this.repo.find({ order: { createdAt: 'DESC' }, take: 300 });
  }
}
