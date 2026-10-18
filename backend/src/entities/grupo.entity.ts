import { ProgramaEspecial } from './programa-especial.entity';
import { NivelAcademico } from './nivel-academico.entity';
import { CarreraPlan } from './carrera-plan.entity';
import { PeriodoAcademico } from './periodo-academico.entity';
import { Check, Index, Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { CicloEscolar } from './ciclo-escolar.entity';
import { Plantel } from './plantel.entity';

@Entity('grupos')
@Index('idx_grupo_programa', ['programaEspecialId', 'tipo'])
@Check('ck_grupo_modalidad', "(tipo = 'REGULAR' AND programa_especial_id IS NULL AND cupo_manual IS NULL) OR (tipo = 'ESPECIAL' AND programa_especial_id IS NOT NULL AND cupo_manual IS NOT NULL AND cupo_manual BETWEEN 1 AND 10000)")
@Index('idx_grupos_contexto', ['plantelId', 'nivelId', 'carreraId', 'periodoAcademicoId'])
@Check('ck_grupo_contexto_completo', '(nivel_id IS NULL AND carrera_id IS NULL AND periodo_academico_id IS NULL) OR (nivel_id IS NOT NULL AND carrera_id IS NOT NULL AND periodo_academico_id IS NOT NULL)')
@Unique('uq_grupo_ciclo_plantel_nombre', ['cicloId', 'plantelId', 'nombre'])
export class Grupo {
  @PrimaryGeneratedColumn() id!: number;
  @Column() cicloId!: number;
  @ManyToOne(() => CicloEscolar, { eager: true })
  @JoinColumn({ name: 'ciclo_id' })
  ciclo!: CicloEscolar;
  @Column() plantelId!: number;
  @ManyToOne(() => Plantel, { eager: true })
  @JoinColumn({ name: 'plantel_id' })
  plantel!: Plantel;
  @Column({ length: 40 }) nombre!: string;
  @Column({ type: String, length: 20, nullable: true }) grado!: string | null;
  @Column({ type: String, length: 10, nullable: true }) turno!: 'MATUTINO' | 'VESPERTINO' | null;
  @Column({ type: 'int', nullable: true }) nivelId!: number | null;
  @ManyToOne(() => NivelAcademico, { nullable: true }) @JoinColumn({ name: 'nivel_id' }) nivel!: NivelAcademico | null;
  @Column({ type: 'int', nullable: true }) carreraId!: number | null;
  @ManyToOne(() => CarreraPlan, { nullable: true }) @JoinColumn({ name: 'carrera_id' }) carrera!: CarreraPlan | null;
  @Column({ type: 'int', nullable: true }) periodoAcademicoId!: number | null;
  @ManyToOne(() => PeriodoAcademico, { nullable: true }) @JoinColumn({ name: 'periodo_academico_id' }) periodoAcademico!: PeriodoAcademico | null;
  @Column({ type: String, length: 12, default: 'REGULAR' }) tipo!: 'REGULAR' | 'ESPECIAL';
  @Column({ type: 'int', nullable: true }) programaEspecialId!: number | null;
  @ManyToOne(() => ProgramaEspecial, { nullable: true }) @JoinColumn({ name: 'programa_especial_id' }) programaEspecial!: ProgramaEspecial | null;
  @Column({ type: 'int', nullable: true }) cupoManual!: number | null;
  @Column({ default: true }) activo!: boolean;
  /** Columna ya presente en baseline v1 y en ambos esquemas físicos. */
  @Column({ type: 'bigint', nullable: true }) legacyId!: string | null;
}
