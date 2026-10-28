import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('usuario_vinculos_persona')
@Unique('uq_vinculo_alumno_usuario', ['alumnoUsuarioId'])
@Unique('uq_vinculo_personal_usuario', ['personalUsuarioId'])
export class UsuarioVinculoPersona {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ name: 'alumno_usuario_id', type: 'int' }) alumnoUsuarioId!: number;
  @Column({ name: 'personal_usuario_id', type: 'int' }) personalUsuarioId!: number;
  @Column({ name: 'autorizado_por_id', type: 'int' }) autorizadoPorId!: number;
  @Column({ length: 200 }) motivo!: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
}
