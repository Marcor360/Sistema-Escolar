import {
  Column, CreateDateColumn, DeleteDateColumn, Entity, JoinTable,
  Index, ManyToMany, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { Rol } from './rol.entity';

export type ProveedorCorreo = 'GODADDY' | 'MICROSOFT365';

@Entity('usuarios')
export class Usuario {
  @PrimaryGeneratedColumn() id!: number;
  @Index('uq_usuario_email', { unique: true, where: 'email IS NOT NULL' })
  @Column({ type: String, length: 120, nullable: true }) email!: string | null;
  @Column({ name: 'correo_personal', type: String, length: 120, nullable: true }) correoPersonal!: string | null;
  @Column({ length: 100, select: false }) passwordHash!: string;
  @Column({ length: 80 }) nombre!: string;
  @Column({ name: 'segundo_nombre', type: String, length: 80, nullable: true }) segundoNombre!: string | null;
  @Column({ length: 80 }) apellidoPaterno!: string;
  @Column({ type: String, length: 80, nullable: true }) apellidoMaterno!: string | null;
  @Column({ type: String, length: 20, nullable: true }) telefono!: string | null;
  @Column({ default: true }) activo!: boolean;
  @Column({ name: 'correo_proveedor', type: String, length: 20, default: 'GODADDY' }) correoProveedor!: ProveedorCorreo;
  @Column({ default: false }) passwordChangeRequired!: boolean;
  @Column({ default: false }) activacionPendiente!: boolean;
  @Column({ name: 'session_version', type: 'int', default: 0 }) sessionVersion!: number;

  @ManyToMany(() => Rol, { eager: true })
  @JoinTable({
    name: 'usuario_roles',
    joinColumn: { name: 'usuario_id' },
    inverseJoinColumn: { name: 'rol_id' },
  })
  roles!: Rol[];

  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
  @DeleteDateColumn({ type: Date }) deletedAt!: Date | null;

  /** Vínculo con la base certweb para la migración inicial (ETL); no se expone en la API pública. */
  @Column({ type: 'bigint', nullable: true }) legacyId!: string | null;

  get nombreCompleto(): string {
    return [this.nombre, this.segundoNombre, this.apellidoPaterno, this.apellidoMaterno].filter(Boolean).join(' ');
  }
}
