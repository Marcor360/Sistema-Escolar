import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Alumno } from './alumno.entity';
import { Grupo } from './grupo.entity';

@Entity('inscripciones')
@Unique('uq_insc', ['alumnoId', 'grupoId'])
export class Inscripcion {
  @PrimaryGeneratedColumn() id: number;
  @Column() alumnoId: number;
  @ManyToOne(() => Alumno, { eager: true })
  @JoinColumn({ name: 'alumno_id' })
  alumno: Alumno;
  @Column() grupoId: number;
  @ManyToOne(() => Grupo, { eager: true })
  @JoinColumn({ name: 'grupo_id' })
  grupo: Grupo;
  @CreateDateColumn({ name: 'fecha_inscripcion' }) fechaInscripcion: Date;
  @Column({ length: 15, default: 'ACTIVA' }) estatus: 'ACTIVA' | 'BAJA';
}
