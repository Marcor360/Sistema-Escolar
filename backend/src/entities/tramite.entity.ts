import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Alumno } from './alumno.entity';
import { Plantel } from './plantel.entity';
import { Usuario } from './usuario.entity';
@Entity('tramites')
@Index('idx_tramite_plantel_estado', ['plantelId', 'estado'])
export class Tramite {
  @PrimaryGeneratedColumn() id!: number;
  @Column() alumnoId!: number;
  @ManyToOne(() => Alumno) @JoinColumn({ name: 'alumno_id' }) alumno!: Alumno;
  @Column() plantelId!: number;
  @ManyToOne(() => Plantel) @JoinColumn({ name: 'plantel_id' }) plantel!: Plantel;
  @Column({ length: 36, unique: true }) clave!: string;
  @Column({ length: 25 }) tipo!: 'CONSTANCIA' | 'CORRECCION' | 'DOCUMENTO';
  @Column({ length: 600 }) detalle!: string;
  @Column({ length: 20, default: 'SOLICITADO' }) estado!:
    'SOLICITADO' | 'EN_REVISION' | 'RESUELTO' | 'RECHAZADO' | 'CANCELADO';
  @Column({ type: 'int', nullable: true }) responsableId!: number | null;
  @ManyToOne(() => Usuario) @JoinColumn({ name: 'responsable_id' }) responsable!: Usuario | null;
  @Column({ default: 1 }) revision!: number;
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
}
