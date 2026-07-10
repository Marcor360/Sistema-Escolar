import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('planteles')
export class Plantel {
  @PrimaryGeneratedColumn() id: number;
  @Column({ length: 80, unique: true }) clave: string;
  @Column({ length: 150 }) nombre: string;
  @Column({ length: 200, nullable: true }) direccion: string | null;
  @Column({ default: true }) activo: boolean;
}
