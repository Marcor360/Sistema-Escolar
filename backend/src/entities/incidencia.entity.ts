import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { Alumno } from './alumno.entity';
import { Grupo } from './grupo.entity';
import { Usuario } from './usuario.entity';

@Index('idx_incidencia_alumno', ['alumnoId', 'grupoId'])
@Entity('incidencias')
export class Incidencia {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'int' }) alumnoId!: number;
  @Column({ type: 'int' }) grupoId!: number;
  @Column({ type: 'int' }) registradaPorId!: number;
  @Column({ type: String, length: 40 }) tipo!: string;
  @Column({ type: String, length: 10 }) gravedad!: string;
  @Column({ type: String, length: 2000 }) descripcion!: string;
  @Column({ type: String, length: 15 }) estado!: string;
  @Column({ type: Date }) fecha!: Date;

  @ManyToOne(() => Alumno, {}) @JoinColumn({ name: 'alumno_id', foreignKeyConstraintName: 'fk_incidencias_alumno_id' }) alumno!: Alumno;
  @ManyToOne(() => Grupo, {}) @JoinColumn({ name: 'grupo_id', foreignKeyConstraintName: 'fk_incidencias_grupo_id' }) grupo!: Grupo;
  @ManyToOne(() => Usuario, {}) @JoinColumn({ name: 'registrada_por_id', foreignKeyConstraintName: 'fk_incidencias_registrada_por_id' }) registradaPor!: Usuario;
}
