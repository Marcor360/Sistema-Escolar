import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Pago } from '../entities/pago.entity';
import { OrdenPago } from '../entities/orden-pago.entity';
import { AlumnosService } from '../alumnos/alumnos.service';
import { CargosService } from './cargos.service';
import { BitacoraFinancieraService } from './bitacora-financiera.service';
import { JwtUser } from '../common/current-user.decorator';
import { ScopeService } from '../planteles/scope.service';
import { ListarPagosDto, RegistrarPagoDto } from './finanzas.dto';

/** Única responsabilidad: registrar pagos (ventanilla y pasarela) y consultarlos. */
@Injectable()
export class PagosService {
  constructor(
    @InjectRepository(Pago) private readonly pagos: Repository<Pago>,
    private readonly alumnos: AlumnosService,
    private readonly cargos: CargosService,
    private readonly bitacora: BitacoraFinancieraService,
    private readonly scope: ScopeService,
  ) {}

  async listar(query: ListarPagosDto, user: JwtUser) {
    const pagina = query.pagina || 1;
    const porPagina = query.porPagina || 20;
    const planteles = await this.scope.resolverFiltro(user);
    const qb = this.pagos.createQueryBuilder('p').innerJoinAndSelect('p.alumno', 'a');
    if (planteles !== null) qb.andWhere('a.plantel_id IN (:...planteles)', { planteles });
    if (query.alumnoId) qb.andWhere('p.alumno_id = :alumnoId', { alumnoId: query.alumnoId });
    const [datos, total] = await qb
      .orderBy('p.id', 'DESC')
      .skip((pagina - 1) * porPagina)
      .take(porPagina)
      .getManyAndCount();
    return { datos, total, pagina, porPagina };
  }

  /** Pago manual de ventanilla (efectivo/transferencia/tarjeta). */
  async registrarManual(dto: RegistrarPagoDto, user: JwtUser) {
    await this.alumnos.obtener(dto.alumnoId, user);
    if (dto.cargoId) {
      const cargo = await this.cargos.obtener(dto.cargoId);
      if (cargo.alumnoId !== dto.alumnoId) throw new BadRequestException('El cargo no pertenece al alumno indicado');
    }
    const pago = await this.pagos.save(
      this.pagos.create({
        alumnoId: dto.alumnoId,
        cargoId: dto.cargoId ?? null,
        monto: dto.monto,
        metodo: dto.metodo,
        referencia: dto.referencia ?? null,
        estatus: 'CONFIRMADO',
        fechaPago: new Date(),
        registradoPorId: user.sub,
      }),
    );
    if (dto.cargoId) await this.cargos.recalcularEstatus(dto.cargoId);
    await this.bitacora.registrar(user.sub, 'PAGO_MANUAL', 'pago', pago.id, `$${dto.monto} ${dto.metodo}`);
    return pago;
  }

  /** Pago confirmado por la pasarela (lo invoca el procesamiento del webhook). */
  async registrarDePasarela(orden: OrdenPago, monto: number, referencia: string) {
    const pago = await this.pagos.save(
      this.pagos.create({
        alumnoId: orden.alumnoId,
        cargoId: orden.cargoId,
        ordenPagoId: orden.id,
        monto,
        metodo: 'PASARELA',
        referencia,
        estatus: 'CONFIRMADO',
        fechaPago: new Date(),
      }),
    );
    if (orden.cargoId) await this.cargos.recalcularEstatus(orden.cargoId);
    await this.bitacora.registrar(null, 'PAGO_PASARELA', 'pago', pago.id, `openpay=${referencia} $${monto}`);
    return pago;
  }
}
