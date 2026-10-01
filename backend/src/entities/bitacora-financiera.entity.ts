import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('bitacora_financiera')
@Index('idx_bitacora_financiera_plantel', ['plantelId', 'createdAt'])
export class BitacoraFinanciera {
  @PrimaryGeneratedColumn() id: number;
  @Column({ nullable: true }) plantelId: number | null;
  @Column({ nullable: true }) usuarioId: number | null;
  @Column({ length: 60 }) accion: string;
  @Column({ length: 40 }) entidad: string;
  @Column({ nullable: true }) entidadId: number | null;
  @Column({ length: 500, nullable: true }) detalle: string | null;
  @CreateDateColumn() createdAt: Date;
}
