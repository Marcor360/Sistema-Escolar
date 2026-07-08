import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { CicloEscolar } from './ciclo-escolar.entity';

@Entity('grupos')
@Unique('uq_grupo_ciclo_nombre', ['cicloId', 'nombre'])
export class Grupo {
  @PrimaryGeneratedColumn() id: number;
  @Column() cicloId: number;
  @ManyToOne(() => CicloEscolar, { eager: true })
  @JoinColumn({ name: 'ciclo_id' })
  ciclo: CicloEscolar;
  @Column({ length: 40 }) nombre: string;
  @Column({ length: 20, nullable: true }) grado: string | null;
  @Column({ length: 10, nullable: true }) turno: 'MATUTINO' | 'VESPERTINO' | null;
}
