import {
  Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn, ManyToOne,
  OneToOne, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { Plantel } from './plantel.entity';
import { Usuario } from './usuario.entity';

export type AlumnoEstatus = 'ACTIVO' | 'BAJA' | 'EGRESADO';

@Entity('alumnos')
export class Alumno {
  @PrimaryGeneratedColumn() id: number;
  @Column({ unique: true }) usuarioId: number;
  @OneToOne(() => Usuario, { eager: true })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;
  @Column() plantelId: number;
  @ManyToOne(() => Plantel, { eager: true })
  @JoinColumn({ name: 'plantel_id' })
  plantel: Plantel;
  @Column({ length: 20, unique: true }) matricula: string;
  @Column({ length: 18, nullable: true }) curp: string | null;
  @Column({ type: 'date', nullable: true }) fechaNacimiento: string | null;
  @Column({ length: 120, nullable: true }) tutorNombre: string | null;
  @Column({ length: 20, nullable: true }) tutorTelefono: string | null;
  @Column({ length: 200, nullable: true }) direccion: string | null;
  @Column({ length: 20, default: 'ACTIVO' }) estatus: AlumnoEstatus;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
  @DeleteDateColumn() deletedAt: Date | null;
  /** Vínculo con la base certweb para la migración inicial (ETL); no se expone en la API pública. */
  @Column({ type: 'bigint', nullable: true }) legacyId: string | null;
}
