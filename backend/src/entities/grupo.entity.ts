import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { CicloEscolar } from './ciclo-escolar.entity';
import { Plantel } from './plantel.entity';

@Entity('grupos')
@Unique('uq_grupo_ciclo_nombre', ['cicloId', 'nombre'])
export class Grupo {
  @PrimaryGeneratedColumn() id: number;
  @Column() cicloId: number;
  @ManyToOne(() => CicloEscolar, { eager: true })
  @JoinColumn({ name: 'ciclo_id' })
  ciclo: CicloEscolar;
  @Column() plantelId: number;
  @ManyToOne(() => Plantel, { eager: true })
  @JoinColumn({ name: 'plantel_id' })
  plantel: Plantel;
  @Column({ length: 40 }) nombre: string;
  @Column({ length: 20, nullable: true }) grado: string | null;
  @Column({ length: 10, nullable: true }) turno: 'MATUTINO' | 'VESPERTINO' | null;
  @Column({ default: true }) activo: boolean;
}
