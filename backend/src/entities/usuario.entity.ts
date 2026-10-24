import {
  Column, CreateDateColumn, DeleteDateColumn, Entity, JoinTable,
  ManyToMany, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { Rol } from './rol.entity';

export type ProveedorCorreo = 'GODADDY' | 'MICROSOFT365';

export function proveedorCorreoPredeterminado(roles: readonly string[]): ProveedorCorreo {
  return roles.includes('ALUMNO') ? 'MICROSOFT365' : 'GODADDY';
}

@Entity('usuarios')
export class Usuario {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ length: 120, unique: true }) email!: string;
  @Column({ length: 100, select: false }) passwordHash!: string;
  @Column({ length: 80 }) nombre!: string;
  @Column({ length: 80 }) apellidoPaterno!: string;
  @Column({ type: String, length: 80, nullable: true }) apellidoMaterno!: string | null;
  @Column({ type: String, length: 20, nullable: true }) telefono!: string | null;
  @Column({ default: true }) activo!: boolean;
  @Column({ name: 'correo_proveedor', type: 'varchar', length: 20, default: 'GODADDY' }) correoProveedor!: ProveedorCorreo;
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
    return [this.nombre, this.apellidoPaterno, this.apellidoMaterno].filter(Boolean).join(' ');
  }
}
