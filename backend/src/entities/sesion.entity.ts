import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Usuario } from './usuario.entity';

@Entity('sesiones')
@Index('idx_sesiones_usuario', ['usuarioId'])
export class Sesion {
  @PrimaryColumn({ length: 36 }) id!: string;
  @Column({ type: 'int' }) usuarioId!: number;
  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'usuario_id' }) usuario!: Usuario;
  @Column({ length: 5 }) portal!: 'WEB' | 'MOVIL';
  @Column({ length: 64 }) refreshHash!: string;
  @Column({ type: 'int' }) version!: number;
  @Column({ type: Date }) expiraEn!: Date;
  @Column({ default: false }) revocada!: boolean;
}
