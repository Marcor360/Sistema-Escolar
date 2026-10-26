import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { MovimientoBancario } from '../entities/movimiento-bancario.entity';
import { Cargo } from '../entities/cargo.entity';
import { ScopeService } from '../planteles/scope.service';
import { PagosService } from '../finanzas/pagos.service';
import { JwtUser } from '../common/current-user.decorator';
import { ImportarBancoDto } from './banco.dto';
export const huellaMovimiento = (plantelId: number, cuenta: string, folio: string) =>
  createHash('sha256')
    .update(JSON.stringify([plantelId, cuenta, folio]))
    .digest('hex');
@Injectable()
export class BancoService {
  constructor(
    private readonly ds: DataSource,
    private readonly scope: ScopeService,
    private readonly pagos: PagosService,
  ) {}
  async preview(dto: ImportarBancoDto, user: JwtUser) {
    await this.scope.validarGestion(user, dto.plantelId);
    if (new Set(dto.movimientos.map((m) => m.folio)).size !== dto.movimientos.length)
      throw new BadRequestException('El archivo contiene folios repetidos');
    const resultado = [];
    const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
    for (const m of dto.movimientos) {
      if (m.fecha > hoy) throw new BadRequestException('Los movimientos no pueden tener fecha futura');
      const existente = await this.ds
        .getRepository(MovimientoBancario)
        .findOneBy({ huella: huellaMovimiento(dto.plantelId, dto.cuenta, m.folio) });
      if (
        existente &&
        (existente.monto !== m.monto || existente.fecha !== m.fecha || existente.referencia !== m.referencia)
      )
        throw new ConflictException('Un folio existente tiene datos distintos');
      const id = /^IUA-C\d{10}$/.test(m.referencia) ? Number(m.referencia.slice(5)) : 0;
      const cargo = id ? await this.ds.getRepository(Cargo).findOneBy({ id, plantelId: dto.plantelId }) : null;
      resultado.push({
        ...m,
        duplicado: !!existente,
        cargoSugerido: cargo && cargo.estatus !== 'CANCELADO' ? { id: cargo.id, descripcion: cargo.descripcion } : null,
      });
    }
    return resultado;
  }
  async importar(dto: ImportarBancoDto, user: JwtUser) {
    await this.preview(dto, user);
    await this.ds.transaction(async (m) => {
      const repo = m.getRepository(MovimientoBancario);
      for (const fila of dto.movimientos) {
        const huella = huellaMovimiento(dto.plantelId, dto.cuenta, fila.folio);
        if (!(await repo.existsBy({ huella })))
          await repo.save({
            ...fila,
            huella,
            plantelId: dto.plantelId,
            cuenta: dto.cuenta,
            clavePago: randomUUID(),
            estado: 'PENDIENTE',
          });
      }
    });
    return { ok: true };
  }
  async listar(user: JwtUser) {
    const planteles = await this.scope.resolverFiltro(user),
      qb = this.ds.getRepository(MovimientoBancario).createQueryBuilder('m');
    if (planteles) qb.where('m.plantel_id IN (:...planteles)', { planteles });
    return qb.orderBy('m.id', 'DESC').take(100).getMany();
  }
  async aplicar(id: number, cargoId: number, user: JwtUser) {
    const reservado = await this.ds.transaction(async (m) => {
      const repo = m.getRepository(MovimientoBancario),
        mov = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!mov) throw new NotFoundException();
      await this.scope.validarGestion(user, mov.plantelId);
      if (mov.cargoId && mov.cargoId !== cargoId)
        throw new ConflictException('El movimiento ya está vinculado a otro cargo');
      const cargo = await m.getRepository(Cargo).findOneBy({ id: cargoId, plantelId: mov.plantelId });
      if (!cargo) throw new BadRequestException('El cargo no pertenece al plantel del movimiento');
      if (!mov.cargoId) {
        mov.cargoId = cargoId;
        mov.estado = 'ASIGNADO';
        await repo.save(mov);
      }
      return { mov, alumnoId: cargo.alumnoId };
    });
    // La clave persistida recupera un pago confirmado aunque se interrumpa la actualización del movimiento.
    const pago = await this.pagos.registrarManual(
      {
        cargoId,
        alumnoId: reservado.alumnoId,
        monto: reservado.mov.monto,
        metodo: 'TRANSFERENCIA',
        referencia: reservado.mov.folio,
        claveIdempotencia: reservado.mov.clavePago,
      },
      user,
      { verificarReferenciaPlantel: true, fechaPago: new Date(reservado.mov.fecha + 'T12:00:00-06:00') },
    );
    await this.ds.getRepository(MovimientoBancario).update(id, { pagoId: pago.id, estado: 'APLICADO' });
    return { pagoId: pago.id, ok: true };
  }
}
