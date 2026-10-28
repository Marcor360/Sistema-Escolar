import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';
import { EgresoAlumno } from './egreso-alumno.entity';
import { CarreraPlan } from './carrera-plan.entity';
import { Usuario } from './usuario.entity';

export type EstadoExpedienteTitulacion = 'BORRADOR' | 'VALIDADO' | 'CANCELADO';
export type ModalidadRvoe = 'SIN_DETERMINAR' | 'FEDERAL' | 'ESTATAL';

@Entity('titulacion_expedientes')
@Unique('uq_titulacion_egreso_plan', ['egresoId', 'carreraPlanId'])
export class TitulacionExpediente {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ name: 'egreso_id', type: 'int' }) egresoId!: number;
  @ManyToOne(() => EgresoAlumno, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'egreso_id' }) egreso!: EgresoAlumno;
  @Column({ name: 'carrera_plan_id', type: 'int' }) carreraPlanId!: number;
  @ManyToOne(() => CarreraPlan, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'carrera_plan_id' }) carreraPlan!: CarreraPlan;
  @Column({ name: 'creado_por_id', type: 'int' }) creadoPorId!: number;
  @ManyToOne(() => Usuario, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'creado_por_id' }) creadoPor!: Usuario;
  @Column({ type: String, length: 20, default: 'BORRADOR' }) estado!: EstadoExpedienteTitulacion;
  @Column({ name: 'modalidad_rvoe', type: String, length: 20, default: 'SIN_DETERMINAR' })
  modalidadRvoe!: ModalidadRvoe;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}
