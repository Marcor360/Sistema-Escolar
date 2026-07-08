import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('bitacora_financiera')
export class BitacoraFinanciera {
  @PrimaryGeneratedColumn() id: number;
  @Column({ nullable: true }) usuarioId: number | null;
  @Column({ length: 60 }) accion: string;
  @Column({ length: 40 }) entidad: string;
  @Column({ nullable: true }) entidadId: number | null;
  @Column({ length: 500, nullable: true }) detalle: string | null;
  @CreateDateColumn() createdAt: Date;
}
