import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { decimalTransformer } from '../common/decimal.transformer';

/** Instantánea inmutable de cada captura; sobrevive a cambios del registro principal. */
@Entity('historial_calificaciones')
@Index('idx_historial_periodo', ['grupoMateriaId', 'parcial'])
export class HistorialCalificacion {
  @PrimaryGeneratedColumn() id!: number;
  @Index('idx_historial_calificacion') @Column() calificacionId!: number;
  @Column() alumnoId!: number;
  @Column() grupoMateriaId!: number;
  @Column() parcial!: number;
  @Column('decimal', { precision: 9, scale: 6, nullable: true, transformer: decimalTransformer })
  valorAnterior!: number | null;
  @Column('decimal', { precision: 9, scale: 6, transformer: decimalTransformer }) valorNuevo!: number;
  @Column({ type: String, length: 300, nullable: true }) observacionAnterior!: string | null;
  @Column({ type: String, length: 300, nullable: true }) observacionNueva!: string | null;
  @Column({ default: 100 }) escalaAnterior!: number;
  @Column({ default: 100 }) escalaNueva!: number;
  @Column({ type: 'text', nullable: true }) detalleCalculo!: string | null;
  @Column() usuarioId!: number;
  @CreateDateColumn() fecha!: Date;
  @Column({ type: String, length: 300, nullable: true }) motivo!: string | null;
}
