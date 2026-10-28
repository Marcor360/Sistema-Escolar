import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Alumno } from './alumno.entity';
import { CicloEscolar } from './ciclo-escolar.entity';

/** Un solo egreso institucional por identidad; los datos académicos originales no se duplican. */
@Entity('egresos_alumnos')
@Unique('uq_egreso_alumno', ['alumnoId'])
@Index('idx_egreso_ciclo_fecha', ['cicloId', 'fechaEgreso'])
@Index('uq_egreso_curp', ['curp'], { unique: true, where: 'curp IS NOT NULL' })
export class EgresoAlumno {
  @PrimaryGeneratedColumn() id!: number;
  @Column() alumnoId!: number;
  @ManyToOne(() => Alumno, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'alumno_id' })
  alumno!: Alumno;
  @Column() cicloId!: number;
  @ManyToOne(() => CicloEscolar, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'ciclo_id' })
  ciclo!: CicloEscolar;
  @Column({ type: String, length: 18 }) curp!: string;
  /** Fecha civil de evidencia legada, sin inventar una hora de egreso. */
  @Column({ type: 'date', nullable: true }) fechaDocumental!: string | null;
  @Column({ type: 'datetime' }) fechaEgreso!: Date;
  @Column({ type: 'datetime' }) archivarDesde!: Date;
  @Column({ type: String, length: 15, default: 'VIGENTE' }) estadoArchivo!: 'VIGENTE' | 'ARCHIVADO';
  @Column({ type: String, length: 300, nullable: true }) rutaArchivo!: string | null;
  @Column({ type: String, length: 64, nullable: true }) sha256Archivo!: string | null;
  @Column({ type: 'datetime', nullable: true }) archivadoEn!: Date | null;
}
