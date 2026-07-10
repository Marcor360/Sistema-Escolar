import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Plantel } from './plantel.entity';
import { Usuario } from './usuario.entity';

@Entity('usuario_planteles')
export class UsuarioPlantel {
  @PrimaryColumn() usuarioId: number;
  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  @PrimaryColumn() plantelId: number;
  @ManyToOne(() => Plantel, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'plantel_id' })
  plantel: Plantel;

  @Column({ default: true }) activo: boolean;
}
