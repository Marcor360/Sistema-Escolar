import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Alumno } from './alumno.entity';
import { GrupoMateria } from './grupo-materia.entity';
import { Usuario } from './usuario.entity';
import { Plantel } from './plantel.entity';
@Entity('asistencias')
@Unique('uq_asistencia_clase_fecha_alumno', ['grupoMateriaId', 'fecha', 'alumnoId'])
@Index('idx_asistencia_alumno_fecha', ['alumnoId', 'fecha'])
export class Asistencia {
  @PrimaryGeneratedColumn() id!: number;
  @Column() grupoMateriaId!: number;
  @ManyToOne(() => GrupoMateria) @JoinColumn({ name: 'grupo_materia_id' }) grupoMateria!: GrupoMateria;
  @Column() alumnoId!: number;
  @ManyToOne(() => Alumno) @JoinColumn({ name: 'alumno_id' }) alumno!: Alumno;
  @Column() plantelId!: number;
  @ManyToOne(() => Plantel) @JoinColumn({ name: 'plantel_id' }) plantel!: Plantel;
  @Column({ type: 'date' }) fecha!: string;
  @Column({ length: 15 }) estado!: 'PRESENTE' | 'FALTA' | 'RETARDO' | 'JUSTIFICADA';
  @Column() capturadoPorId!: number;
  @ManyToOne(() => Usuario) @JoinColumn({ name: 'capturado_por_id' }) capturadoPor!: Usuario;
  @UpdateDateColumn() updatedAt!: Date;
}
