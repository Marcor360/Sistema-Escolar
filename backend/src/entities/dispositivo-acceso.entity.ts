import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, Unique } from 'typeorm';
import { Usuario } from './usuario.entity';

/** Recuerda una instalación por cuenta aunque sus sesiones hayan expirado y se hayan depurado. */
@Entity('auth_dispositivos_acceso')
@Unique('uq_auth_dispositivos_aviso', ['primerEventoId'])
export class DispositivoAcceso {
  @PrimaryColumn({ type: 'int' }) usuarioId!: number;
  @PrimaryColumn({ length: 64 }) huella!: string;
  @Column({ length: 36 }) primerEventoId!: string;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario!: Usuario;
}
