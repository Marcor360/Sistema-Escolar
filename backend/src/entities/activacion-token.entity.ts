import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Usuario } from './usuario.entity';

@Entity('activacion_tokens')
@Index('idx_activacion_usuario', ['usuarioId'])
export class ActivacionToken {
  @PrimaryColumn({ length: 36 }) id!: string;
  @Column({ type: 'int' }) usuarioId!: number;
  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' }) usuario!: Usuario;
  @Column({ length: 64, unique: true }) token!: string;
  @Column({ type: Date }) expiraEn!: Date;
  @Column({ default: false }) usado!: boolean;
  @Column({ type: 'int', default: 0 }) intentos!: number;
  @CreateDateColumn({ type: Date }) createdAt!: Date;
}
