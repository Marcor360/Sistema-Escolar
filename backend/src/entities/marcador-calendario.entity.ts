import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Plantel } from './plantel.entity';
@Entity('calendario_marcadores')
@Unique('uq_calendario_marcador_plantel', ['plantelId', 'clave'])
export class MarcadorCalendario {
  @PrimaryGeneratedColumn() id!: number;
  @Column() plantelId!: number;
  @ManyToOne(() => Plantel) @JoinColumn({ name: 'plantel_id' }) plantel!: Plantel;
  @Column({ length: 50 }) clave!: string;
  @Column({ length: 150 }) nombre!: string;
  @Column({ length: 7 }) color!: string;
  @Column({ length: 15 }) forma!: 'FONDO' | 'INICIO' | 'FIN';
  @Column({ default: 1 }) revision!: number;
}
