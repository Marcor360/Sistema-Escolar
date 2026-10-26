import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
@Entity('calendario_historial')
export class CalendarioHistorial {
  @PrimaryGeneratedColumn() id!: number;
  @Column() eventoId!: number;
  @Column() usuarioId!: number;
  @Column({ type: 'int', nullable: true }) plantelId!: number | null;
  @Column({ length: 20 }) accion!: string;
  @Column({ length: 600 }) alcance!: string;
  @CreateDateColumn() createdAt!: Date;
}
