import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { decimalTransformer } from '../common/decimal.transformer';
import { GrupoMateria } from './grupo-materia.entity';

export type ActividadTipo = 'TAREA' | 'EXAMEN' | 'PROYECTO' | 'PARTICIPACION';

@Entity('actividades')
export class Actividad {
  @PrimaryGeneratedColumn() id: number;
  @Column() grupoMateriaId: number;
  @ManyToOne(() => GrupoMateria, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'grupo_materia_id' })
  grupoMateria: GrupoMateria;
  @Column({ length: 150 }) titulo: string;
  @Column({ type: 'text', nullable: true }) descripcion: string | null;
  @Column({ length: 20, default: 'TAREA' }) tipo: ActividadTipo;
  @Column({ default: 1 }) parcial: number;
  @Column('decimal', { precision: 5, scale: 2, default: 0, transformer: decimalTransformer })
  ponderacion: number;
  @Column({ type: 'datetime', nullable: true }) fechaEntrega: Date | null;
  @Column({ default: true }) activo: boolean;
  @CreateDateColumn() createdAt: Date;
}
