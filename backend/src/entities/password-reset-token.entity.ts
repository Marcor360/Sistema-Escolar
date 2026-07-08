import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Usuario } from './usuario.entity';

@Entity('password_reset_tokens')
export class PasswordResetToken {
  @PrimaryGeneratedColumn() id: number;
  @Column() usuarioId: number;
  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;
  @Column({ length: 64, unique: true }) token: string;
  @Column({ type: 'datetime' }) expiraEn: Date;
  @Column({ default: false }) usado: boolean;
  @CreateDateColumn() createdAt: Date;
}
