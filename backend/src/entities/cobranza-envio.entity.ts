import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Plantel } from './plantel.entity';
import { Usuario } from './usuario.entity';
import { decimalTransformer } from '../common/decimal.transformer';
@Entity('cobranza_envios')
export class CobranzaEnvio {
  @PrimaryGeneratedColumn() id: number;
  @Index('uq_cobranza_clave', { unique: true }) @Column({ length: 64 }) clave: string;
  @Column() plantelId: number;
  @ManyToOne(() => Plantel) @JoinColumn({ name: 'plantel_id' }) plantel: Plantel;
  @Column() usuarioId: number;
  @ManyToOne(() => Usuario) @JoinColumn({ name: 'usuario_id' }) usuario: Usuario;
  @Column() actorId: number;
  @ManyToOne(() => Usuario) @JoinColumn({ name: 'actor_id' }) actor: Usuario;
  @Column('decimal', { precision: 12, scale: 2, transformer: decimalTransformer }) saldo: number;
  @Column({ length: 15, default: 'PENDIENTE' }) estado: 'PENDIENTE' | 'ENVIANDO' | 'ENVIADO' | 'ERROR' | 'INCIERTO';
  @Column({ default: 0 }) intentos: number;
  @Column({ type: 'datetime' }) proximoIntento: Date;
  @Column({ type: String, length: 80, nullable: true }) error: string | null;
  @CreateDateColumn() createdAt: Date;
}
