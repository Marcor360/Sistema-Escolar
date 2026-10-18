import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Materia } from './materia.entity';
import { PeriodoAcademico } from './periodo-academico.entity';

/** Una materia compartida puede figurar en varios planes/periodos sin duplicar su identidad. */
@Entity('materia_contextos')
@Unique('uq_materia_periodo', ['materiaId', 'periodoAcademicoId'])
export class MateriaContexto {
  @PrimaryGeneratedColumn() id!: number;
  @Column() materiaId!: number;
  @ManyToOne(() => Materia) @JoinColumn({ name: 'materia_id' }) materia!: Materia;
  @Column() periodoAcademicoId!: number;
  @ManyToOne(() => PeriodoAcademico) @JoinColumn({ name: 'periodo_academico_id' }) periodoAcademico!: PeriodoAcademico;
  @Column({ default: true }) activo!: boolean;
}
