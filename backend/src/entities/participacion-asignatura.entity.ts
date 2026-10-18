import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Alumno } from './alumno.entity';
import { GrupoMateria } from './grupo-materia.entity';
import { Inscripcion } from './inscripcion.entity';
@Entity('participaciones_asignatura')
@Unique('uq_participacion_idempotencia', ['idempotencia'])
@Unique('uq_participacion_intento', ['alumnoId','grupoMateriaId','intento'])
@Index('uq_participacion_activa', ['activoClave'], { unique: true, where: 'activo_clave IS NOT NULL' })
export class ParticipacionAsignatura {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ length: 36 }) idempotencia!: string;
  @Column() alumnoId!: number;
  @ManyToOne(() => Alumno) @JoinColumn({ name: 'alumno_id' }) alumno!: Alumno;
  @Column() grupoMateriaId!: number;
  @ManyToOne(() => GrupoMateria) @JoinColumn({ name: 'grupo_materia_id' }) grupoMateria!: GrupoMateria;
  @Column() inscripcionPrincipalId!: number;
  @ManyToOne(() => Inscripcion) @JoinColumn({ name: 'inscripcion_principal_id' }) inscripcionPrincipal!: Inscripcion;
  @Column() cupoTotalConfirmado!: number;
  @Column() intento!: number;
  @Column({ type: String, length: 12, default: 'ACTIVA' }) estado!: 'ACTIVA' | 'BAJA' | 'FINALIZADA';
  @Column({ type: String, length: 80, nullable: true }) activoClave!: string | null;
  @CreateDateColumn() createdAt!: Date;
}
@Entity('cupos_recursamiento')
export class CupoRecursamiento {
  @PrimaryGeneratedColumn() id!: number;
  @Index('uq_cupo_clase', { unique: true }) @Column() grupoMateriaId!: number;
  @ManyToOne(() => GrupoMateria) @JoinColumn({ name: 'grupo_materia_id' }) grupoMateria!: GrupoMateria;
  @Column() cupoTotalManual!: number;
}
