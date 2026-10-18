import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Usuario } from './usuario.entity';

export type TipoCorreoAcceso = 'ACTIVACION' | 'RECUPERACION';
export type EstadoCorreoAcceso = 'PENDIENTE' | 'PROCESANDO' | 'ACEPTADO' | 'FALLIDO' | 'EXPIRADO' | 'CANCELADO';

@Entity('auth_correo_outbox')
@Index('idx_auth_outbox_pendiente', ['estado', 'proximoIntento'])
@Index('idx_auth_outbox_usuario', ['usuarioId', 'tipo', 'expiraEn'])
export class AuthCorreoOutbox {
  @PrimaryColumn({ length: 36 }) id!: string;
  @Column({ type: 'int' }) usuarioId!: number;
  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' }) usuario!: Usuario;
  @Column({ length: 16 }) tipo!: TipoCorreoAcceso;
  @Column({ length: 16, default: 'PENDIENTE' }) estado!: EstadoCorreoAcceso;
  @Column({ type: 'int' }) version!: number;
  @Column({ type: 'varchar', length: 40, nullable: true }) claveId!: string | null;
  @Column({ type: 'varchar', length: 64, nullable: true }) tokenHash!: string | null;
  @Column({ type: 'int', default: 0 }) intentos!: number;
  @Column({ type: Date }) proximoIntento!: Date;
  @Column({ type: Date }) expiraEn!: Date;
  @Column({ type: Date, nullable: true }) leaseHasta!: Date | null;
  @Column({ type: 'varchar', length: 36, nullable: true }) claim!: string | null;
  @Column({ type: 'varchar', length: 24, nullable: true }) errorCodigo!: string | null;
  @CreateDateColumn() createdAt!: Date;
}
