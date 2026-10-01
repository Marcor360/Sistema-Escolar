import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Pago } from '../entities/pago.entity';
import { OrdenPago } from '../entities/orden-pago.entity';
import { BitacoraFinanciera } from '../entities/bitacora-financiera.entity';
import { AlumnosService } from '../alumnos/alumnos.service';
import { CargosService } from './cargos.service';
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
    private readonly scope: ScopeService,
    private readonly dataSource: DataSource,
  ) {}

  async listar(query: ListarPagosDto, user: JwtUser) {
    const pagina = query.pagina || 1;
    const porPagina = query.porPagina || 20;
    const planteles = await this.scope.resolverFiltro(user);
    const qb = this.pagos.createQueryBuilder('p')
      .innerJoinAndSelect('p.alumno', 'a')
      .leftJoinAndSelect('a.usuario', 'u');
    if (planteles !== null) qb.andWhere('a.plantel_id IN (:...planteles)', { planteles });
    if (query.alumnoId) qb.andWhere('p.alumno_id = :alumnoId', { alumnoId: query.alumnoId });
    const [datos, total] = await qb
      .orderBy('p.id', 'DESC')
      .skip((pagina - 1) * porPagina)
      .take(porPagina)
      .getManyAndCount();
    return {
      datos: datos.map((pago) => ({
        id: pago.id,
        monto: pago.monto,
        metodo: pago.metodo,
        referencia: pago.referencia,
        estatus: pago.estatus,
        fechaPago: pago.fechaPago,
        alumno: {
          id: pago.alumno.id,
          matricula: pago.alumno.matricula,
          usuario: {
            nombre: pago.alumno.usuario.nombre,
            apellidoPaterno: pago.alumno.usuario.apellidoPaterno,
          },
        },
      })),
      total, pagina, porPagina,
    };
  }

  /** Pago manual de ventanilla (efectivo/transferencia/tarjeta). */
  async registrarManual(dto: RegistrarPagoDto, user: JwtUser) {
    const alumno = await this.alumnos.obtener(dto.alumnoId, user);
    if (dto.cargoId) {
      const cargo = await this.cargos.obtener(dto.cargoId);
      if (cargo.alumnoId !== dto.alumnoId) throw new BadRequestException('El cargo no pertenece al alumno indicado');
    }
    return this.dataSource.transaction(async (manager) => {
      const pagos = manager.getRepository(Pago);
      const pago = await pagos.save(
        pagos.create({
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
      if (dto.cargoId) await this.cargos.recalcularEstatus(dto.cargoId, manager);
      await manager.getRepository(BitacoraFinanciera).insert({
        usuarioId: user.sub,
        plantelId: alumno.plantelId,
        accion: 'PAGO_MANUAL',
        entidad: 'pago',
        entidadId: pago.id,
        detalle: `$${dto.monto} ${dto.metodo}`,
      });
      return pago;
    });
  }

  /** Pago confirmado por la pasarela (lo invoca el procesamiento del webhook). */
  async registrarDePasarela(orden: OrdenPago, monto: number, referencia: string) {
    const existente = await this.pagos.findOne({ where: { ordenPagoId: orden.id } });
    if (existente) {
      // Recalcular repara estados derivados y se confirma en la misma transacción.
      if (orden.cargoId) {
        await this.dataSource.transaction((manager) => this.cargos.recalcularEstatus(orden.cargoId!, manager));
      }
      return { pago: existente, creado: false };
    }

    try {
      const pago = await this.dataSource.transaction(async (manager) => {
        const pagos = manager.getRepository(Pago);
        const nuevo = await pagos.save(
          pagos.create({
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
        if (orden.cargoId) await this.cargos.recalcularEstatus(orden.cargoId, manager);
        await manager.getRepository(BitacoraFinanciera).insert({
          usuarioId: null,
          plantelId: orden.alumno.plantelId,
          accion: 'PAGO_PASARELA',
          entidad: 'pago',
          entidadId: nuevo.id,
          detalle: `openpay=${referencia} $${monto}`,
        });
        return nuevo;
      });
      return { pago, creado: true };
    } catch (error) {
      // Dos reintentos concurrentes pueden pasar la consulta anterior. El índice
      // único elige al ganador; la transacción perdedora se revierte antes de leerlo.
      const pagoConcurrente = await this.pagos.findOne({ where: { ordenPagoId: orden.id } });
      if (!pagoConcurrente) throw error;
      if (orden.cargoId) {
        await this.dataSource.transaction((manager) => this.cargos.recalcularEstatus(orden.cargoId!, manager));
      }
      return { pago: pagoConcurrente, creado: false };
    }
  }
}
