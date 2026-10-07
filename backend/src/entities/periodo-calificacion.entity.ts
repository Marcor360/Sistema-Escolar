import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { GrupoMateria } from './grupo-materia.entity';

export type EstadoPeriodoCalificacion = 'ABIERTO' | 'CERRADO';

@Entity('periodos_calificacion')
@Unique('uq_periodo_calificacion', ['grupoMateriaId', 'parcial'])
export class PeriodoCalificacion {
  @PrimaryGeneratedColumn() id: number;
  @Column() grupoMateriaId: number;
  @ManyToOne(() => GrupoMateria, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'grupo_materia_id' })
  grupoMateria: GrupoMateria;
  @Column() parcial: number;
  @Column({ length: 10, default: 'ABIERTO' }) estatus: EstadoPeriodoCalificacion;
  @Column({ type: 'int', nullable: true }) cerradoPorId: number | null;
  @Column({ type: 'datetime', nullable: true }) cerradoAt: Date | null;
  @Column({ type: 'int', nullable: true }) reabiertoPorId: number | null;
  @Column({ type: 'datetime', nullable: true }) reabiertoAt: Date | null;
}
