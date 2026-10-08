import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { Usuario } from './usuario.entity';
import { Sesion } from './sesion.entity';

@Index('uq_push_token', ['token'], { unique: true })
@Entity('push_dispositivos')
export class PushDispositivo {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'int' }) usuarioId!: number;
  @Column({ type: String, length: 36 }) sesionId!: string;
  @Column({ type: String, length: 36 }) instalacionId!: string;
  @Column({ type: String, length: 200 }) token!: string;
  @Column({ type: Boolean }) activo!: boolean;
  @Column({ type: Date }) actualizadoEn!: Date;

  @ManyToOne(() => Usuario, {}) @JoinColumn({ name: 'usuario_id', foreignKeyConstraintName: 'fk_push_dispositivos_usuario_id' }) usuario!: Usuario;
  @ManyToOne(() => Sesion, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'sesion_id', foreignKeyConstraintName: 'fk_push_dispositivos_sesion_id' }) sesion!: Sesion;
}
