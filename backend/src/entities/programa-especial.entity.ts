import { Check, Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Plantel } from './plantel.entity';
import { CicloEscolar } from './ciclo-escolar.entity';
@Entity('programas_especiales')
@Check('ck_programa_tipo', "tipo IN ('DIPLOMADO','CERTIFICACION','ESPECIALIZACION','EXTRACURRICULAR')")
@Check('ck_programa_estado', "estado IN ('ACTIVO','CERRADO','CANCELADO')")
@Check('ck_programa_fechas', 'fecha_inicio <= fecha_fin')
@Unique('uq_programa_plantel_ciclo_clave', ['plantelId', 'cicloId', 'clave'])
export class ProgramaEspecial {
  @PrimaryGeneratedColumn() id!: number;
  @Column() plantelId!: number;
  @ManyToOne(() => Plantel) @JoinColumn({ name: 'plantel_id' }) plantel!: Plantel;
  @Column() cicloId!: number;
  @ManyToOne(() => CicloEscolar) @JoinColumn({ name: 'ciclo_id' }) ciclo!: CicloEscolar;
  @Column({ length: 20 }) clave!: string;
  @Column({ length: 120 }) nombre!: string;
  @Column({ type: String, length: 24 }) tipo!: 'DIPLOMADO' | 'CERTIFICACION' | 'ESPECIALIZACION' | 'EXTRACURRICULAR';
  @Column({ type: 'date' }) fechaInicio!: string;
  @Column({ type: 'date' }) fechaFin!: string;
  @Column({ type: String, length: 16, default: 'ACTIVO' }) estado!: 'ACTIVO' | 'CERRADO' | 'CANCELADO';
}
