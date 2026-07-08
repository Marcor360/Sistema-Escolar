import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('materias')
export class Materia {
  @PrimaryGeneratedColumn() id: number;
  @Column({ length: 20, unique: true }) clave: string;
  @Column({ length: 120 }) nombre: string;
  @Column({ length: 300, nullable: true }) descripcion: string | null;
  @Column({ default: 0 }) creditos: number;
  @Column({ default: true }) activo: boolean;
}
