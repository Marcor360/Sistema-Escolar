import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { Notificacion } from './notificacion.entity';
import { PushDispositivo } from './push-dispositivo.entity';

@Index('uq_push_notificacion_dispositivo', ['notificacionId', 'dispositivoId'], { unique: true })
@Index('idx_push_pendientes', ['estado', 'proximoIntento'])
@Entity('push_envios')
export class PushEnvio {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'int' }) notificacionId: number;
  @Column({ type: 'int' }) dispositivoId: number;
  @Column({ type: String, length: 15 }) estado: string;
  @Column({ type: 'int' }) intentos: number;
  @Column({ type: Date }) proximoIntento: Date;
  @Column({ type: String, length: 100, nullable: true }) ticketId: string | null;
  @Column({ type: String, length: 100, nullable: true }) error: string | null;

  @ManyToOne(() => Notificacion, {}) @JoinColumn({ name: 'notificacion_id', foreignKeyConstraintName: 'fk_push_envios_notificacion_id' }) notificacion: Notificacion;
  @ManyToOne(() => PushDispositivo, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'dispositivo_id', foreignKeyConstraintName: 'fk_push_envios_dispositivo_id' }) dispositivo: PushDispositivo;
}
