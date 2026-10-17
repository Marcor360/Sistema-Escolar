import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { BitacoraFinanciera } from '../entities/bitacora-financiera.entity';
import { ScopeService } from '../planteles/scope.service';
import { PaginacionDto } from '../common/paginacion.dto';
import { JwtUser } from '../common/current-user.decorator';

/** Única responsabilidad: registrar y consultar movimientos financieros. */
@Injectable()
export class BitacoraFinancieraService {
  constructor(
    @InjectRepository(BitacoraFinanciera)
    private readonly repo: Repository<BitacoraFinanciera>,
    private readonly scope: ScopeService,
  ) {}

  registrar(
    usuarioId: number | null, accion: string, entidad: string, entidadId: number | null,
    detalle: string, plantelId: number | null = null, manager?: EntityManager,
  ) {
    const repo = manager?.getRepository(BitacoraFinanciera) ?? this.repo;
    return repo.insert({ usuarioId, plantelId, accion, entidad, entidadId, detalle: detalle.slice(0, 500) });
  }

  async listar(user: JwtUser) {
    const planteles = await this.scope.resolverFiltro(user);
    return this.repo.find({
      ...(planteles === null ? {} : { where: { plantelId: In(planteles) } }),
      order: { createdAt: 'DESC' }, take: 300,
    });
  }
  async resoluciones(user: JwtUser, query: PaginacionDto) {
    const planteles = await this.scope.resolverFiltro(user);
    const [datos, total] = await this.repo.findAndCount({
      where: {
        accion: In(['CONCILIAR_ORDEN', 'CONCILIAR_PAGO']),
        ...(planteles === null ? {} : { plantelId: In(planteles) }),
      },
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: (query.pagina - 1) * query.porPagina, take: query.porPagina,
    });
    return { datos, total, pagina: query.pagina, porPagina: query.porPagina };
  }

}
