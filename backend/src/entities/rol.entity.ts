import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('roles')
export class Rol {
  @PrimaryGeneratedColumn() id: number;
  @Column({ length: 30, unique: true }) clave: string;
  @Column({ length: 80 }) nombre: string;
}
