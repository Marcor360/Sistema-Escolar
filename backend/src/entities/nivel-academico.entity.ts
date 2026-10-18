import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Plantel } from './plantel.entity';

@Entity('niveles_academicos')
@Unique('uq_nivel_plantel_clave', ['plantelId', 'clave'])
export class NivelAcademico {
  @PrimaryGeneratedColumn() id!: number;
  @Column() plantelId!: number;
  @ManyToOne(() => Plantel) @JoinColumn({ name: 'plantel_id' }) plantel!: Plantel;
  @Column({ length: 20 }) clave!: string;
  @Column({ length: 120 }) nombre!: string;
  @Column({ default: true }) activo!: boolean;
}
