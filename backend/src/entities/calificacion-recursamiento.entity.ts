import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';
import { decimalTransformer } from '../common/decimal.transformer';
import { ParticipacionAsignatura } from './participacion-asignatura.entity';
import { Usuario } from './usuario.entity';
@Entity('calificaciones_recursamiento')
@Unique('uq_nota_recursamiento', ['participacionId','parcial'])
export class CalificacionRecursamiento {
  @PrimaryGeneratedColumn() id!: number;
  @Column() participacionId!: number;
  @ManyToOne(() => ParticipacionAsignatura) @JoinColumn({ name: 'participacion_id' }) participacion!: ParticipacionAsignatura;
  @Column() parcial!: number;
  @Column({ default: 100 }) escalaMaxima!: number;
  @Column('decimal', { precision: 9, scale: 6, transformer: decimalTransformer }) calificacion!: number;
  @Column() capturadaPorId!: number;
  @ManyToOne(() => Usuario) @JoinColumn({ name: 'capturada_por_id' }) capturadaPor!: Usuario;
  @UpdateDateColumn() updatedAt!: Date;
}
@Entity('historial_recursamiento')
export class HistorialRecursamiento {
  @PrimaryGeneratedColumn() id!: number;
  @Column() participacionId!: number;
  @ManyToOne(() => ParticipacionAsignatura) @JoinColumn({ name: 'participacion_id' }) participacion!: ParticipacionAsignatura;
  @Column() parcial!: number;
  @Column({ type: 'decimal', precision: 9, scale: 6, nullable: true, transformer: decimalTransformer }) anterior!: number | null;
  @Column('decimal', { precision: 9, scale: 6, transformer: decimalTransformer }) nueva!: number;
  @Column({ default: 100 }) escalaAnterior!: number;
  @Column({ default: 100 }) escalaNueva!: number;
  @Column() usuarioId!: number;
  @ManyToOne(() => Usuario) @JoinColumn({ name: 'usuario_id' }) usuario!: Usuario;
  @Column({ length: 400 }) motivo!: string;
  @CreateDateColumn() createdAt!: Date;
}
