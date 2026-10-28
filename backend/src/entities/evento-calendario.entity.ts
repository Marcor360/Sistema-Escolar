import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Plantel } from './plantel.entity';

@Entity('eventos_calendario')
export class EventoCalendario {
  @Column({ type: String, length: 50, nullable: true }) marcadorClave!: string | null;
  @Index('uq_evento_importacion', { unique: true, where: 'clave_importacion IS NOT NULL' })
  @Column({ type: String, length: 64, nullable: true }) claveImportacion!: string | null;
  @Column({ type: 'int', nullable: true }) cicloId!: number | null;
  @Column({ type: 'int', nullable: true }) nivelId!: number | null;
  @Column({ length: 20, default: 'ACADEMICA' }) audiencia!: 'ACADEMICA' | 'ADMINISTRATIVA' | 'FINANCIERA';
  @Column({ type: String, length: 100, nullable: true }) imagenNombre!: string | null;
  @PrimaryGeneratedColumn() id!: number;
  @Column({ length: 150 }) titulo!: string;
  @Column({ type: String, length: 400, nullable: true }) descripcion!: string | null;
  @Column({ length: 30, default: 'GENERAL' }) tipo!: 'GENERAL' | 'EXAMEN' | 'ENTREGA' | 'FESTIVO' | 'PAGO' | 'JUNTA';
  @Column({ type: 'datetime' }) fechaInicio!: Date;
  @Column({ type: 'datetime', nullable: true }) fechaFin!: Date | null;
  @Column({ type: 'int', nullable: true }) plantelId!: number | null;
  @ManyToOne(() => Plantel, { nullable: true })
  @JoinColumn({ name: 'plantel_id' })
  plantel!: Plantel | null;
  @Column({ type: 'int', nullable: true }) grupoId!: number | null;
  @Column({ type: 'int', nullable: true }) creadoPorId!: number | null;
}
