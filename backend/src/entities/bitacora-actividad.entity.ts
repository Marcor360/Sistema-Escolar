import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type BitacoraResultado = 'EXITO' | 'ERROR';

@Entity('bitacora_actividad')
export class BitacoraActividad {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'int', nullable: true }) usuarioId!: number | null;
  @Column({ length: 8 }) metodo!: string;
  @Column({ length: 200 }) ruta!: string;
  @Column({ type: String, length: 100, nullable: true }) entidad!: string | null;
  @Column({ type: 'int', nullable: true }) entidadId!: number | null;
  @Column({ length: 10, default: 'EXITO' }) resultado!: BitacoraResultado;
  @Column({ type: 'smallint', nullable: true }) statusCode!: number | null;
  @Column({ type: String, length: 45, nullable: true }) ip!: string | null;
  @CreateDateColumn() createdAt!: Date;
}
