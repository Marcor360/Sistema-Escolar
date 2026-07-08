import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { decimalTransformer } from '../common/decimal.transformer';
import { Actividad } from './actividad.entity';
import { Alumno } from './alumno.entity';

@Entity('entregas')
@Unique('uq_entrega', ['actividadId', 'alumnoId'])
export class Entrega {
  @PrimaryGeneratedColumn() id: number;
  @Column() actividadId: number;
  @ManyToOne(() => Actividad, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'actividad_id' })
  actividad: Actividad;
  @Column() alumnoId: number;
  @ManyToOne(() => Alumno, { eager: true })
  @JoinColumn({ name: 'alumno_id' })
  alumno: Alumno;
  @Column({ length: 500, nullable: true }) comentarioAlumno: string | null;
  @Column({ length: 200, nullable: true }) archivoNombre: string | null;
  @Column({ length: 300, nullable: true }) archivoRuta: string | null;
  @Column('decimal', { precision: 5, scale: 2, nullable: true, transformer: decimalTransformer })
  calificacion: number | null;
  @Column({ length: 500, nullable: true }) comentarioDocente: string | null;
  @Column({ length: 15, default: 'ENTREGADA' }) estatus: 'ENTREGADA' | 'CALIFICADA' | 'TARDE';
  /** Columna normal (no CreateDateColumn): se actualiza al reentregar una tarea. */
  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' }) fechaEntregado: Date;
}
