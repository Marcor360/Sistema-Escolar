import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { Usuario } from './usuario.entity';
import { Plantel } from './plantel.entity';

@Index('idx_academica_plantel', ['plantelId', 'fecha'])
@Entity('bitacora_academica')
export class BitacoraAcademica {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'int' }) usuarioId!: number;
  @Column({ type: 'int', nullable: true }) plantelId!: number | null;
  @Column({ type: String, length: 40 }) accion!: string;
  @Column({ type: 'int' }) entidadId!: number;
  @Column({ type: String, length: 1000 }) detalle!: string;
  @Column({ type: Date }) fecha!: Date;

  @ManyToOne(() => Usuario, {}) @JoinColumn({ name: 'usuario_id', foreignKeyConstraintName: 'fk_bitacora_academica_usuario_id' }) usuario!: Usuario;
  @ManyToOne(() => Plantel, {}) @JoinColumn({ name: 'plantel_id', foreignKeyConstraintName: 'fk_bitacora_academica_plantel_id' }) plantel!: Plantel;
}
