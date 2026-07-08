import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { decimalTransformer } from '../common/decimal.transformer';
import { Alumno } from './alumno.entity';
import { Cargo } from './cargo.entity';
import { OrdenPago } from './orden-pago.entity';

export type PagoMetodo = 'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA' | 'PASARELA';
export type PagoEstatus = 'CONFIRMADO' | 'PENDIENTE' | 'FALLIDO' | 'CANCELADO';

@Entity('pagos')
export class Pago {
  @PrimaryGeneratedColumn() id: number;
  @Index('idx_pago_alumno') @Column() alumnoId: number;
  @ManyToOne(() => Alumno, { eager: true })
  @JoinColumn({ name: 'alumno_id' })
  alumno: Alumno;
  @Column({ nullable: true }) cargoId: number | null;
  @ManyToOne(() => Cargo, { nullable: true })
  @JoinColumn({ name: 'cargo_id' })
  cargo: Cargo | null;
  @Column({ nullable: true }) ordenPagoId: number | null;
  @ManyToOne(() => OrdenPago, { nullable: true })
  @JoinColumn({ name: 'orden_pago_id' })
  ordenPago: OrdenPago | null;
  @Column('decimal', { precision: 12, scale: 2, transformer: decimalTransformer }) monto: number;
  @Column({ length: 15 }) metodo: PagoMetodo;
  @Column({ length: 60, nullable: true }) referencia: string | null;
  @Column({ length: 15, default: 'CONFIRMADO' }) estatus: PagoEstatus;
  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' }) fechaPago: Date;
  @Column({ nullable: true }) registradoPorId: number | null;
  @CreateDateColumn() createdAt: Date;
}
