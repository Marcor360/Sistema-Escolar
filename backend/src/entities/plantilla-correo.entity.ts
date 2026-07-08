import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('plantillas_correo')
export class PlantillaCorreo {
  @PrimaryGeneratedColumn() id: number;
  @Column({ length: 30, unique: true }) clave: string;
  @Column({ length: 150 }) asunto: string;
  @Column({ type: 'text' }) cuerpoHtml: string;
}
