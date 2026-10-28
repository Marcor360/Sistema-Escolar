import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Plantel } from './plantel.entity';
import { CarreraPlan } from './carrera-plan.entity';
import { CicloEscolar } from './ciclo-escolar.entity';

@Entity('periodos_academicos')
@Unique('uq_periodo_carrera_ciclo_clave', ['carreraId', 'cicloId', 'clave'])
@Unique('uq_periodo_carrera_ciclo_numero', ['carreraId', 'cicloId', 'tipo', 'numero'])
export class PeriodoAcademico {
  @PrimaryGeneratedColumn() id!: number;
  @Column() plantelId!: number;
  @ManyToOne(() => Plantel) @JoinColumn({ name: 'plantel_id' }) plantel!: Plantel;
  @Column() carreraId!: number;
  @ManyToOne(() => CarreraPlan) @JoinColumn({ name: 'carrera_id' }) carrera!: CarreraPlan;
  @Column() cicloId!: number;
  @ManyToOne(() => CicloEscolar) @JoinColumn({ name: 'ciclo_id' }) ciclo!: CicloEscolar;
  @Column({ length: 20 }) clave!: string;
  @Column({ length: 120 }) nombre!: string;
  @Column({ type: String, length: 16 }) tipo!: 'ANUAL' | 'SEMESTRAL' | 'CUATRIMESTRAL';
  @Column({ type: 'int' }) numero!: number;
  @Column({type:'date',nullable:true}) fechaInicio!:string|null;
  @Column({type:'date',nullable:true}) fechaFin!:string|null;
  @Column({ default: true }) activo!: boolean;
}
