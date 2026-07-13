import {
  Column, CreateDateColumn, DeleteDateColumn, Entity, JoinTable,
  ManyToMany, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { Rol } from './rol.entity';

@Entity('usuarios')
export class Usuario {
  @PrimaryGeneratedColumn() id: number;
  @Column({ length: 120, unique: true }) email: string;
  @Column({ length: 100 }) passwordHash: string;
  @Column({ length: 80 }) nombre: string;
  @Column({ length: 80 }) apellidoPaterno: string;
  @Column({ length: 80, nullable: true }) apellidoMaterno: string | null;
  @Column({ length: 20, nullable: true }) telefono: string | null;
  @Column({ default: true }) activo: boolean;

  @ManyToMany(() => Rol, { eager: true })
  @JoinTable({
    name: 'usuario_roles',
    joinColumn: { name: 'usuario_id' },
    inverseJoinColumn: { name: 'rol_id' },
  })
  roles: Rol[];

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
  @DeleteDateColumn() deletedAt: Date | null;

  /** Vínculo con la base certweb para la migración inicial (ETL); no se expone en la API pública. */
  @Column({ type: 'bigint', nullable: true }) legacyId: string | null;

  get nombreCompleto(): string {
    return [this.nombre, this.apellidoPaterno, this.apellidoMaterno].filter(Boolean).join(' ');
  }
}
