import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Asistencia } from './asistencia.entity';
import { Usuario } from './usuario.entity';
@Entity('asistencias_historial')
export class AsistenciaHistorial {
  @PrimaryGeneratedColumn() id!: number;
  @Column() asistenciaId!: number;
  @ManyToOne(() => Asistencia) @JoinColumn({ name: 'asistencia_id' }) asistencia!: Asistencia;
  @Column() usuarioId!: number;
  @ManyToOne(() => Usuario) @JoinColumn({ name: 'usuario_id' }) usuario!: Usuario;
  @Column({ type: String, length: 15, nullable: true }) anterior!: string | null;
  @Column({ length: 15 }) nuevo!: string;
  @Column({ length: 250 }) motivo!: string;
  @CreateDateColumn() createdAt!: Date;
}
