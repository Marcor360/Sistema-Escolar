import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Plantel } from './plantel.entity';
import { NivelAcademico } from './nivel-academico.entity';

@Entity('carreras_planes')
@Unique('uq_carrera_plan', ['plantelId', 'nivelId', 'clave', 'versionPlan'])
export class CarreraPlan {
  @PrimaryGeneratedColumn() id!: number;
  @Column() plantelId!: number;
  @ManyToOne(() => Plantel) @JoinColumn({ name: 'plantel_id' }) plantel!: Plantel;
  @Column() nivelId!: number;
  @ManyToOne(() => NivelAcademico) @JoinColumn({ name: 'nivel_id' }) nivel!: NivelAcademico;
  @Column({ length: 20 }) clave!: string;
  @Column({ length: 120 }) nombre!: string;
  @Column({ length: 40 }) versionPlan!: string;
  @Column({ default: true }) activo!: boolean;
}
