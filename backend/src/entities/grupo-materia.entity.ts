import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Grupo } from './grupo.entity';
import { Materia } from './materia.entity';
import { Docente } from './docente.entity';

/** Materia impartida en un grupo por un docente. */
@Entity('grupo_materias')
@Unique('uq_gm', ['grupoId', 'materiaId'])
export class GrupoMateria {
  @PrimaryGeneratedColumn() id: number;
  @Column() grupoId: number;
  @ManyToOne(() => Grupo, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'grupo_id' })
  grupo: Grupo;
  @Column() materiaId: number;
  @ManyToOne(() => Materia, { eager: true })
  @JoinColumn({ name: 'materia_id' })
  materia: Materia;
  @Column({ nullable: true }) docenteId: number | null;
  @ManyToOne(() => Docente, { eager: true, nullable: true })
  @JoinColumn({ name: 'docente_id' })
  docente: Docente | null;
  /** Vínculo con la base certweb para la migración inicial (ETL); no se expone en la API pública. */
  @Column({ type: 'bigint', nullable: true }) legacyId: string | null;
}
