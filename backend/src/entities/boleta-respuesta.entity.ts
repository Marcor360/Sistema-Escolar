import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Inscripcion } from './inscripcion.entity';
import { Usuario } from './usuario.entity';
import { GrupoMateria } from './grupo-materia.entity';
@Entity('boleta_respuestas')
@Index('uq_boleta_respuesta_clave', ['idempotencia'], { unique: true })
@Index('idx_boleta_respuesta_inscripcion', ['inscripcionId', 'id'])
export class BoletaRespuesta {
  @PrimaryGeneratedColumn() id!: number;
  @Column() inscripcionId!: number;
  @ManyToOne(() => Inscripcion) @JoinColumn({ name: 'inscripcion_id' }) inscripcion!: Inscripcion;
  @Column() actorId!: number;
  @ManyToOne(() => Usuario) @JoinColumn({ name: 'actor_id' }) actor!: Usuario;
  @Column({ type: 'int', nullable: true }) grupoMateriaId!: number | null;
  @ManyToOne(() => GrupoMateria, { nullable: true })
  @JoinColumn({ name: 'grupo_materia_id' })
  grupoMateria!: GrupoMateria | null;
  @Column({ length: 36 }) idempotencia!: string;
  @Column({ length: 64 }) peticionHash!: string;
  @Column({ length: 64 }) versionHash!: string;
  @Column({ length: 12 }) estado!: 'ACEPTADA' | 'REVISION' | 'COMENTARIO';
  @Column({ length: 150 }) firmanteNombre!: string;
  @Column({ length: 10 }) firmanteTipo!: 'ALUMNO' | 'TUTOR' | 'DOCENTE';
  @Column({ length: 2000, default: '' }) comentario!: string;
  @Column({ type: 'text', nullable: true }) snapshotJson!: string | null;
  @CreateDateColumn() createdAt!: Date;
}
