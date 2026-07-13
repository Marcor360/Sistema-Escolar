import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Usuario } from './usuario.entity';

@Entity('planteles')
export class Plantel {
  @PrimaryGeneratedColumn() id: number;
  @Column({ length: 80, unique: true }) clave: string;
  @Column({ length: 150 }) nombre: string;
  @Column({ length: 200, nullable: true }) direccion: string | null;
  @Column({ length: 80, nullable: true }) municipio: string | null;
  @Column({ length: 20, nullable: true }) telefono: string | null;
  @Column({ nullable: true }) directorUsuarioId: number | null;
  @ManyToOne(() => Usuario, { eager: true, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'director_usuario_id' })
  director: Usuario | null;
  @Column({ default: true }) activo: boolean;
  /** Vínculo con la base certweb para la migración inicial (ETL); no se expone en la API pública. */
  @Column({ type: 'bigint', nullable: true }) legacyId: string | null;
}
