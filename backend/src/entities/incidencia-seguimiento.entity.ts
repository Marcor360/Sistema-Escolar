import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { Incidencia } from './incidencia.entity';
import { Usuario } from './usuario.entity';

@Index('idx_seguimiento_incidencia', ['incidenciaId'])
@Entity('incidencia_seguimientos')
export class IncidenciaSeguimiento {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'int' }) incidenciaId!: number;
  @Column({ type: 'int' }) usuarioId!: number;
  @Column({ type: String, length: 2000 }) nota!: string;
  @Column({ type: String, length: 500 }) motivo!: string;
  @Column({ type: String, length: 15 }) estado!: string;
  @Column({ type: Date }) fecha!: Date;

  @ManyToOne(() => Incidencia, {}) @JoinColumn({ name: 'incidencia_id', foreignKeyConstraintName: 'fk_incidencia_seguimientos_incidencia_id' }) incidencia!: Incidencia;
  @ManyToOne(() => Usuario, {}) @JoinColumn({ name: 'usuario_id', foreignKeyConstraintName: 'fk_incidencia_seguimientos_usuario_id' }) usuario!: Usuario;
}
