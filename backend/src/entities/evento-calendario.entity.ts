import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Plantel } from './plantel.entity';

@Entity('eventos_calendario')
export class EventoCalendario {
  @PrimaryGeneratedColumn() id: number;
  @Column({ length: 150 }) titulo: string;
  @Column({ type: String, length: 400, nullable: true }) descripcion: string | null;
  @Column({ length: 30, default: 'GENERAL' }) tipo: 'GENERAL' | 'EXAMEN' | 'ENTREGA' | 'FESTIVO' | 'PAGO' | 'JUNTA';
  @Column({ type: 'datetime' }) fechaInicio: Date;
  @Column({ type: 'datetime', nullable: true }) fechaFin: Date | null;
  @Column({ type: 'int', nullable: true }) plantelId: number | null;
  @ManyToOne(() => Plantel, { nullable: true })
  @JoinColumn({ name: 'plantel_id' })
  plantel: Plantel | null;
  @Column({ type: 'int', nullable: true }) grupoId: number | null;
  @Column({ type: 'int', nullable: true }) creadoPorId: number | null;
}
