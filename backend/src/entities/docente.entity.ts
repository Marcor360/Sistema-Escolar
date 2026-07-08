import {
  Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn,
  OneToOne, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { Usuario } from './usuario.entity';

@Entity('docentes')
export class Docente {
  @PrimaryGeneratedColumn() id: number;
  @Column({ unique: true }) usuarioId: number;
  @OneToOne(() => Usuario, { eager: true })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;
  @Column({ length: 20, unique: true }) numEmpleado: string;
  @Column({ length: 20, nullable: true }) cedulaProfesional: string | null;
  @Column({ length: 120, nullable: true }) especialidad: string | null;
  @Column({ length: 20, default: 'ACTIVO' }) estatus: 'ACTIVO' | 'BAJA';
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
  @DeleteDateColumn() deletedAt: Date | null;
}
