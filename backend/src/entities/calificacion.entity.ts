import {
  Column, CreateDateColumn, Entity, JoinColumn, ManyToOne,
  PrimaryGeneratedColumn, Unique, UpdateDateColumn,
} from 'typeorm';
import { decimalTransformer } from '../common/decimal.transformer';
import { Alumno } from './alumno.entity';
import { GrupoMateria } from './grupo-materia.entity';

/** Calificación por parcial (1-3); parcial 0 = final. */
@Entity('calificaciones')
@Unique('uq_calif', ['alumnoId', 'grupoMateriaId', 'parcial'])
export class Calificacion {
  @PrimaryGeneratedColumn() id: number;
  @Column() alumnoId: number;
  @ManyToOne(() => Alumno, { eager: true })
  @JoinColumn({ name: 'alumno_id' })
  alumno: Alumno;
  @Column() grupoMateriaId: number;
  @ManyToOne(() => GrupoMateria, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'grupo_materia_id' })
  grupoMateria: GrupoMateria;
  @Column() parcial: number;
  @Column('decimal', { precision: 5, scale: 2, transformer: decimalTransformer })
  calificacion: number;
  @Column({ length: 300, nullable: true }) observaciones: string | null;
  @Column({ nullable: true }) capturadaPorId: number | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
