import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Tramite } from './tramite.entity';
import { Usuario } from './usuario.entity';
@Entity('tramites_historial')
export class TramiteHistorial {
  @PrimaryGeneratedColumn() id!: number;
  @Column() tramiteId!: number;
  @ManyToOne(() => Tramite) @JoinColumn({ name: 'tramite_id' }) tramite!: Tramite;
  @Column() usuarioId!: number;
  @ManyToOne(() => Usuario) @JoinColumn({ name: 'usuario_id' }) usuario!: Usuario;
  @Column({ length: 20 }) estado!: string;
  @Column({ length: 600 }) mensaje!: string;
  @CreateDateColumn() createdAt!: Date;
}
