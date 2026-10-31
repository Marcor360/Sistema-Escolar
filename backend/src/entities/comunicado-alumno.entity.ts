import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type EstadoComunicado = 'BORRADOR' | 'ENVIADO';
@Entity('comunicados_alumnos')
export class ComunicadoAlumno {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ name: 'plantel_id', type: 'int' }) plantelId!: number;
  @Column({ name: 'creado_por_id', type: 'int' }) creadoPorId!: number;
  @Column({ length: 150 }) titulo!: string;
  @Column({ length: 600 }) mensaje!: string;
  @Column({ length: 20, default: 'BORRADOR' }) estado!: EstadoComunicado;
  @Column({ type: 'int', default: 0 }) destinatarios!: number;
  @Column({ name: 'enviado_en', type: 'datetime', nullable: true }) enviadoEn!: Date | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}
