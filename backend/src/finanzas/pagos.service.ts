import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Pago } from '../entities/pago.entity';
import { OrdenPago } from '../entities/orden-pago.entity';
import { AlumnosService } from '../alumnos/alumnos.service';
import { CargosService } from './cargos.service';
import { BitacoraFinancieraService } from './bitacora-financiera.service';
import { JwtUser } from '../common/current-user.decorator';
import { RegistrarPagoDto } from './finanzas.dto';

/** Única responsabilidad: registrar pagos (ventanilla y pasarela) y consultarlos. */
@Injectable()
export class PagosService {
  constructor(
    @InjectRepository(Pago) private readonly pagos: Repository<Pago>,
    private readonly alumnos: AlumnosService,
    private readonly cargos: CargosService,
    private readonly bitacora: BitacoraFinancieraService,
  ) {}

  listar(alumnoId?: number) {
    return this.pagos.find({
      where: alumnoId ? { alumnoId } : {},
      order: { fechaPago: 'DESC' },
      take: 500,
    });
  }

  /** Pago manual de ventanilla (efectivo/transferencia/tarjeta). */
  async registrarManual(dto: RegistrarPagoDto, user: JwtUser) {
    await this.alumnos.obtener(dto.alumnoId);
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
