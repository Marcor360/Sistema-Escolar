import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { decimalTransformer } from '../common/decimal.transformer';
import { Plantel } from './plantel.entity';
import { Cargo } from './cargo.entity';
import { Pago } from './pago.entity';
@Entity('movimientos_bancarios')
export class MovimientoBancario {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ length: 64, unique: true }) huella!: string;
  @Column() plantelId!: number;
  @ManyToOne(() => Plantel) @JoinColumn({ name: 'plantel_id' }) plantel!: Plantel;
  @Column({ length: 40 }) cuenta!: string;
  @Column({ length: 60 }) folio!: string;
  @Column({ length: 60 }) referencia!: string;
  @Column({ type: 'date' }) fecha!: string;
  @Column('decimal', { precision: 12, scale: 2, transformer: decimalTransformer }) monto!: number;
  @Column({ length: 36, unique: true }) clavePago!: string;
  @Column({ type: 'int', nullable: true }) cargoId!: number | null;
  @ManyToOne(() => Cargo) @JoinColumn({ name: 'cargo_id' }) cargo!: Cargo | null;
  @Column({ type: 'int', nullable: true }) pagoId!: number | null;
  @ManyToOne(() => Pago) @JoinColumn({ name: 'pago_id' }) pago!: Pago | null;
  @Column({ length: 15, default: 'PENDIENTE' }) estado!: 'PENDIENTE' | 'ASIGNADO' | 'APLICADO';
  @CreateDateColumn() createdAt!: Date;
}
