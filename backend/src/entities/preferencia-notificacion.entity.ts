import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Usuario } from './usuario.entity';
@Entity('preferencias_notificacion')
@Unique('uq_preferencia_usuario_tipo', ['usuarioId', 'tipo'])
export class PreferenciaNotificacion {
  @PrimaryGeneratedColumn() id!: number;
  @Column() usuarioId!: number;
  @ManyToOne(() => Usuario) @JoinColumn({ name: 'usuario_id' }) usuario!: Usuario;
  @Column({ length: 30 }) tipo!: 'GENERAL' | 'ACADEMICA' | 'FINANCIERA';
  @Column({ default: true }) push!: boolean;
  @Column({ default: true }) correo!: boolean;
}
