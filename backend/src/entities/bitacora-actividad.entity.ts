import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('bitacora_actividad')
export class BitacoraActividad {
  @PrimaryGeneratedColumn() id: number;
  @Column({ nullable: true }) usuarioId: number | null;
  @Column({ length: 8 }) metodo: string;
  @Column({ length: 200 }) ruta: string;
  @Column({ length: 45, nullable: true }) ip: string | null;
  @CreateDateColumn() createdAt: Date;
}
