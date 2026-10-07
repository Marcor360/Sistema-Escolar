import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { decimalTransformer } from '../common/decimal.transformer';
import { Plantel } from './plantel.entity';
import { Alumno } from './alumno.entity';
import { Cargo } from './cargo.entity';
import { OrdenPago } from './orden-pago.entity';

export type PagoMetodo = 'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA' | 'PASARELA';
export type PagoEstatus = 'CONFIRMADO' | 'PENDIENTE' | 'FALLIDO' | 'CANCELADO';

// Una orden de Openpay solo puede originar un pago. El filtro permite que muchos
// pagos manuales con ordenPagoId=NULL coexistan también en SQL Server.
@Index('uq_pagos_orden_pago', ['ordenPagoId'], {
  unique: true,
  where: 'orden_pago_id IS NOT NULL',
})
@Entity('pagos')
export class Pago {
  @PrimaryGeneratedColumn() id: number;
  @Index('idx_pago_plantel') @Column() plantelId: number;
  @ManyToOne(() => Plantel) @JoinColumn({ name: 'plantel_id' }) plantel: Plantel;
  @Index('idx_pago_alumno') @Column() alumnoId: number;
  @ManyToOne(() => Alumno, { eager: true })
  @JoinColumn({ name: 'alumno_id' })
  alumno: Alumno;
  @Column({ type: 'int', nullable: true }) cargoId: number | null;
  @ManyToOne(() => Cargo, { nullable: true })
  @JoinColumn({ name: 'cargo_id' })
  cargo: Cargo | null;
  @Column({ type: 'int', nullable: true }) ordenPagoId: number | null;
  @ManyToOne(() => OrdenPago, { nullable: true })
  @JoinColumn({ name: 'orden_pago_id' })
  ordenPago: OrdenPago | null;
  @Column('decimal', { precision: 12, scale: 2, transformer: decimalTransformer }) monto: number;
  @Column({ length: 15 }) metodo: PagoMetodo;
  @Column({ type: String, length: 60, nullable: true }) referencia: string | null;
  @Index('uq_pagos_clave_idempotencia', { unique: true, where: 'clave_idempotencia IS NOT NULL' })
  @Column({ type: String, length: 36, nullable: true }) claveIdempotencia: string | null;
  @Column({ length: 15, default: 'CONFIRMADO' }) estatus: PagoEstatus;
  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' }) fechaPago: Date;
  @Column({ type: 'int', nullable: true }) registradoPorId: number | null;
  @CreateDateColumn() createdAt: Date;
  /** Vínculo con la base certweb para la migración inicial (ETL); no se expone en la API pública. */
  @Column({ type: 'bigint', nullable: true }) legacyId: string | null;
}
