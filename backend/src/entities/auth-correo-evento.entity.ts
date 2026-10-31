import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Usuario } from './usuario.entity';

export type TipoEventoSeguridad = 'INGRESO' | 'RECUPERACION_EXITOSA' | 'CAMBIO_PASSWORD';
export type EstadoEventoSeguridad = 'PENDIENTE' | 'PROCESANDO' | 'ENVIADO' | 'FALLIDO';

@Entity('auth_correo_eventos')
@Index('idx_auth_eventos_pendientes', ['estado', 'proximoIntento'])
export class AuthCorreoEvento {
  @PrimaryColumn({ length: 36 }) id!: string;
  @Column({ type: 'int' }) usuarioId!: number;
  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' }) usuario!: Usuario;
  @Column({ length: 24 }) tipo!: TipoEventoSeguridad;
  @Column({ length: 16, default: 'PENDIENTE' }) estado!: EstadoEventoSeguridad;
  @Column({ type: 'int', default: 0 }) intentos!: number;
  @Column({ type: Date }) proximoIntento!: Date;
  @Column({ type: Date, nullable: true }) leaseHasta!: Date | null;
  @Column({ length: 36, nullable: true }) claim!: string | null;
  @CreateDateColumn() createdAt!: Date;
}
