import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { promises as fs } from 'fs';
import { basename, join } from 'path';
import PDFDocument from 'pdfkit';
import { uploadsPath } from '../common/uploads-path';
import { Cargo } from '../entities/cargo.entity';
import { Pago } from '../entities/pago.entity';
import { CuentaDeposito } from '../entities/cuenta-deposito.entity';
import { JwtUser } from '../common/current-user.decorator';
import { ConfiguracionService } from '../configuracion/configuracion.service';
import { ScopeService } from '../planteles/scope.service';
import { CargosService } from './cargos.service';
import { PagosService } from './pagos.service';
import { RegistrarPagoFichaDto } from './fichas.dto';

export function identificadorFicha(cargoId: number): string {
  if (!Number.isSafeInteger(cargoId) || cargoId < 1 || cargoId > 2147483647) throw new BadRequestException('Cargo inválido');
  return 'IUA-C' + String(cargoId).padStart(10, '0');
}
export function cargoIdDeFicha(identificador: string): number {
  if (!/^IUA-C\d{10}$/.test(identificador)) throw new BadRequestException('Identificador inválido');
  const id = Number(identificador.slice(5));
  if (!Number.isInteger(id) || id < 1 || id > 2147483647) throw new BadRequestException('Identificador inválido');
  return id;
}

@Injectable()
export class FichasService {
  constructor(
    @InjectRepository(Cargo) private readonly cargosRepo: Repository<Cargo>,
    @InjectRepository(CuentaDeposito) private readonly cuentas: Repository<CuentaDeposito>,
    @InjectRepository(Pago) private readonly pagosRepo: Repository<Pago>,
    private readonly scope: ScopeService,
    private readonly cargos: CargosService,
    private readonly pagos: PagosService,
    private readonly configuracion: ConfiguracionService,
  ) {}

  private async autorizado(id: number, usuario: JwtUser): Promise<Cargo> {
    const cargo = await this.cargosRepo.findOneBy({ id });
    if (!cargo) throw new NotFoundException('Cargo no encontrado');
    if (usuario.roles.includes('ALUMNO')) {
      if (cargo.alumno.usuarioId !== usuario.sub) throw new ForbiddenException('Solo puedes consultar tus fichas');
    } else await this.scope.validarGestion(usuario, cargo.plantelId);
    return cargo;
  }

  async obtener(id: number, usuario: JwtUser) {
    const cargo = await this.autorizado(id, usuario);
    const [saldo, banco] = await Promise.all([this.cargos.saldoDeCargo(cargo), this.cuentas.findOneBy({ id: 1, activo: true })]);
    return {
      identificador: identificadorFicha(cargo.id), cargoId: cargo.id, concepto: cargo.descripcion,
      periodo: cargo.periodo, vencimiento: cargo.fechaVencimiento,
      total: cargo.monto - cargo.descuento + cargo.recargo, saldo,
      estatus: cargo.estatus === 'CANCELADO' ? 'CANCELADO' : saldo <= 0 ? 'PAGADO' : cargo.estatus,
      alumno: { matricula: cargo.alumno.matricula, nombre: cargo.alumno.usuario.nombreCompleto },
      plantel: cargo.alumno.plantel.nombre,
      banco: banco ? { nombre: 'BBVA', titular: banco.titular, cuenta: banco.numeroCuenta, clabe: banco.clabe } : null,
    };
  }

  async registrar(dto: RegistrarPagoFichaDto, usuario: JwtUser) {
    const id = cargoIdDeFicha(dto.identificador);
    const cargo = await this.autorizado(id, usuario);
    if (cargo.estatus === 'CANCELADO') throw new ConflictException('No se registra un pago para cargo cancelado');
    if (dto.referenciaBancaria.trim() === dto.identificador) throw new BadRequestException('Registra el folio bancario real, no el identificador interno');
    const anterior = await this.pagosRepo.findOne({
      where: { referencia: dto.referenciaBancaria.trim(), metodo: dto.metodo, estatus: 'CONFIRMADO' },
    });
    if (anterior && anterior.claveIdempotencia !== dto.claveIdempotencia) {
      throw new ConflictException('El folio bancario ya fue utilizado en un pago; requiere conciliación');
    }
    const pago = await this.pagos.registrarManual({
      alumnoId: cargo.alumnoId, cargoId: cargo.id, monto: dto.monto,
      metodo: dto.metodo, referencia: dto.referenciaBancaria.trim(), claveIdempotencia: dto.claveIdempotencia,
    }, usuario);
    const actual = await this.cargos.obtener(cargo.id);
    return { identificador: dto.identificador, pagoId: pago.id, estatus: actual.estatus };
  }

  async generarPdf(id: number, usuario: JwtUser): Promise<Buffer> {
    const ficha = await this.obtener(id, usuario);
    if (ficha.estatus === 'CANCELADO') throw new ConflictException('No hay ficha para un cargo cancelado');
    if (!ficha.banco) throw new ConflictException('SUPERADMIN debe registrar y activar la cuenta BBVA antes de emitir fichas');
    const marca = await this.configuracion.obtener();
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks: Buffer[] = [];
    const resultado = new Promise<Buffer>((resolve, reject) => {
      doc.on('data', (fragmento: Buffer) => chunks.push(fragmento));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });
    let tieneLogo = false;
    if (marca.logoUrl && /^\/uploads\/marca-logo-[0-9a-f-]+\.(png|jpe?g)$/i.test(marca.logoUrl)) {
      try {
        const archivo = await fs.readFile(join(uploadsPath(), basename(marca.logoUrl)));
        doc.image(archivo, 48, 48, { fit: [80, 70] });
        tieneLogo = true;
      } catch { /* Se mantiene la identidad textual institucional. */ }
    }
    if (!tieneLogo) doc.font('Helvetica-Bold').fontSize(17).text(marca.nombreCorto, 48, 54, { width: 85 });
    doc.font('Helvetica-Bold').fontSize(17).text(marca.nombreInstitucion, 145, 52, { width: 400 });
    doc.font('Helvetica').fontSize(9).text('FICHA DE DEPÓSITO - DOCUMENTO INFORMATIVO', 145, 88, { width: 400 });
    doc.moveTo(48, 137).lineTo(547, 137).stroke();
    doc.fontSize(11).text('Plantel: ' + ficha.plantel, 48, 154);
    doc.text('Matrícula: ' + ficha.alumno.matricula);
    doc.text('Alumno: ' + ficha.alumno.nombre);
    doc.moveDown();
    doc.font('Helvetica-Bold').text('Concepto: ' + ficha.concepto);
    doc.font('Helvetica').text('Periodo: ' + (ficha.periodo ?? 'No especificado'));
    doc.text('Vencimiento: ' + (ficha.vencimiento ?? 'No especificado'));
    doc.text('Estado: ' + ficha.estatus);
    doc.moveDown();
    doc.font('Helvetica-Bold').fontSize(13).text('Identificador interno: ' + ficha.identificador);
    doc.font('Helvetica').fontSize(11).text('Total del cargo: $' + ficha.total.toFixed(2) + ' MXN');
    doc.font('Helvetica-Bold').text('Saldo pendiente: $' + ficha.saldo.toFixed(2) + ' MXN');
    doc.moveDown(1.5);
    doc.font('Helvetica-Bold').fontSize(16).text('BBVA');
    doc.font('Helvetica').fontSize(11).text('Titular: ' + ficha.banco.titular);
    doc.text('Cuenta para depósito: ' + ficha.banco.cuenta);
    if (ficha.banco.clabe) doc.text('CLABE: ' + ficha.banco.clabe);
    doc.moveDown();
    doc.fontSize(9).text('La referencia es INTERNA de IUA y no representa una referencia bancaria homologada por BBVA. Conserva tu comprobante para verificación de Finanzas.', { width: 495 });
    doc.text('Esta ficha no es un comprobante de pago; el estado cambia solo tras registro y validación del pago.', { width: 495 });
    doc.end();
    return resultado;
  }
}
