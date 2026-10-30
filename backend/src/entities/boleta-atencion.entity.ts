import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { BoletaRespuesta } from './boleta-respuesta.entity';
import { Usuario } from './usuario.entity';
@Entity('boleta_atenciones')
@Index('uq_boleta_atencion_clave', ['idempotencia'], { unique: true })
@Index('idx_boleta_atencion_respuesta', ['respuestaId', 'id'])
export class BoletaAtencion {
  @PrimaryGeneratedColumn() id!: number;
  @Column() respuestaId!: number;
  @ManyToOne(() => BoletaRespuesta) @JoinColumn({ name: 'respuesta_id' }) respuesta!: BoletaRespuesta;
  @Column() actorId!: number;
  @ManyToOne(() => Usuario) @JoinColumn({ name: 'actor_id' }) actor!: Usuario;
  @Column() responsableId!: number;
  @ManyToOne(() => Usuario) @JoinColumn({ name: 'responsable_id' }) responsable!: Usuario;
  @Column({ length: 36 }) idempotencia!: string;
  @Column({ length: 64 }) peticionHash!: string;
  @Column({ length: 12 }) estado!: 'PENDIENTE' | 'EN_ATENCION' | 'RESUELTA';
  @Column({ length: 2000 }) comentario!: string;
  @CreateDateColumn() createdAt!: Date;
}
