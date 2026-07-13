import {
  Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne,
  PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { decimalTransformer } from '../common/decimal.transformer';
import { Alumno } from './alumno.entity';
import { ConceptoPago } from './concepto-pago.entity';
import { CicloEscolar } from './ciclo-escolar.entity';

export type CargoEstatus = 'PENDIENTE' | 'PARCIAL' | 'PAGADO' | 'VENCIDO' | 'CANCELADO';

@Entity('cargos')
export class Cargo {
  @PrimaryGeneratedColumn() id: number;
  @Index('idx_cargo_alumno') @Column() alumnoId: number;
  @ManyToOne(() => Alumno, { eager: true })
  @JoinColumn({ name: 'alumno_id' })
  alumno: Alumno;
  @Column() conceptoId: number;
  @ManyToOne(() => ConceptoPago, { eager: true })
  @JoinColumn({ name: 'concepto_id' })
  concepto: ConceptoPago;
  @Column({ nullable: true }) cicloId: number | null;
  @ManyToOne(() => CicloEscolar, { nullable: true })
  @JoinColumn({ name: 'ciclo_id' })
  ciclo: CicloEscolar | null;
  @Index('idx_cargo_periodo') @Column({ type: 'char', length: 7, nullable: true })
  periodo: string | null; // YYYY-MM
  @Column({ length: 200 }) descripcion: string;
  @Column('decimal', { precision: 12, scale: 2, transformer: decimalTransformer }) monto: number;
  @Column('decimal', { precision: 12, scale: 2, default: 0, transformer: decimalTransformer })
  descuento: number;
  @Column('decimal', { precision: 12, scale: 2, default: 0, transformer: decimalTransformer })
  recargo: number;
  @Column({ type: 'date', nullable: true }) fechaVencimiento: string | null;
  @Column({ length: 15, default: 'PENDIENTE' }) estatus: CargoEstatus;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
  /** Vínculo con la base certweb para la migración inicial (ETL); no se expone en la API pública. */
  @Column({ type: 'bigint', nullable: true }) legacyId: string | null;
}
