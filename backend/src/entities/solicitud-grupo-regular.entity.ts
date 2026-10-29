import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique, Index } from 'typeorm';
import { Alumno } from './alumno.entity';
import { Grupo } from './grupo.entity';
import { Plantel } from './plantel.entity';
import { CicloEscolar } from './ciclo-escolar.entity';
import { NivelAcademico } from './nivel-academico.entity';
import { CarreraPlan } from './carrera-plan.entity';
import { PeriodoAcademico } from './periodo-academico.entity';
@Entity('solicitudes_grupo_regular')
@Unique('uq_solicitud_alumno_ciclo', ['alumnoId', 'cicloId'])
@Index('idx_solicitud_cohorte', ['plantelId','cicloId','periodoAcademicoId','turno','estado'])
export class SolicitudGrupoRegular {
  @PrimaryGeneratedColumn() id!: number;
  @Column() alumnoId!: number;
  @ManyToOne(() => Alumno) @JoinColumn({ name: 'alumno_id' }) alumno!: Alumno;
  @Column() plantelId!: number;
  @ManyToOne(() => Plantel) @JoinColumn({ name: 'plantel_id' }) plantel!: Plantel;
  @Column() cicloId!: number;
  @ManyToOne(() => CicloEscolar) @JoinColumn({ name: 'ciclo_id' }) ciclo!: CicloEscolar;
  @Column() nivelId!: number;
  @ManyToOne(() => NivelAcademico) @JoinColumn({ name: 'nivel_id' }) nivel!: NivelAcademico;
  @Column() carreraId!: number;
  @ManyToOne(() => CarreraPlan) @JoinColumn({ name: 'carrera_id' }) carrera!: CarreraPlan;
  @Column() periodoAcademicoId!: number;
  @ManyToOne(() => PeriodoAcademico) @JoinColumn({ name: 'periodo_academico_id' }) periodo!: PeriodoAcademico;
  @Column({ type: String, length: 10 }) turno!: 'MATUTINO' | 'VESPERTINO';
  @Column({ type: String, length: 12, default: 'PENDIENTE' }) estado!: 'PENDIENTE' | 'ASIGNADA' | 'ANULADA' | 'PAUSA';
  @Column({ type: 'int', nullable: true }) grupoId!: number | null;
  @ManyToOne(() => Grupo, { nullable: true }) @JoinColumn({ name: 'grupo_id' }) grupo!: Grupo | null;
}
