import {
  Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne,
  PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { decimalTransformer } from '../common/decimal.transformer';
import { Alumno } from './alumno.entity';
import { Cargo } from './cargo.entity';

export type OrdenEstatus = 'CREADA' | 'PENDIENTE' | 'COMPLETADA' | 'FALLIDA' | 'CANCELADA' | 'EXPIRADA';

@Entity('ordenes_pago')
export class OrdenPago {
  @PrimaryGeneratedColumn() id: number;
  @Column() alumnoId: number;
  @ManyToOne(() => Alumno, { eager: true })
  @JoinColumn({ name: 'alumno_id' })
  alumno: Alumno;
  @Column({ nullable: true }) cargoId: number | null;
  @ManyToOne(() => Cargo, { nullable: true })
  @JoinColumn({ name: 'cargo_id' })
  cargo: Cargo | null;
  @Column('decimal', { precision: 12, scale: 2, transformer: decimalTransformer }) monto: number;
  @Column({ length: 200 }) descripcion: string;
  @Column({ length: 20, default: 'OPENPAY' }) proveedor: string;
  @Index('idx_orden_externo') @Column({ length: 60, nullable: true }) idExterno: string | null;
  @Column({ length: 300, nullable: true }) urlPago: string | null;
  @Column({ length: 15, default: 'CREADA' }) estatus: OrdenEstatus;
  @Column({ type: 'datetime', nullable: true }) expiraEn: Date | null;
  @Column({ type: 'text', nullable: true }) payloadWebhook: string | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
