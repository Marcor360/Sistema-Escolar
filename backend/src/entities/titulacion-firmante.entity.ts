import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Plantel } from './plantel.entity';
import { Usuario } from './usuario.entity';

export type EstadoFirmanteTitulacion = 'PENDIENTE_VALIDACION' | 'INACTIVO';

@Entity('titulacion_firmantes')
export class TitulacionFirmante {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ name: 'plantel_id', type: 'int' }) plantelId!: number;
  @ManyToOne(() => Plantel, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'plantel_id' }) plantel!: Plantel;
  @Column({ length: 160 }) nombre!: string;
  @Column({ length: 100 }) cargo!: string;
  @Column({ length: 18 }) curp!: string;
  @Column({ name: 'vigente_desde', type: 'date' }) vigenteDesde!: string;
  @Column({ name: 'vigente_hasta', type: 'date', nullable: true }) vigenteHasta!: string | null;
  @Column({ name: 'certificado_sha256', type: String, length: 64, nullable: true }) certificadoSha256!: string | null;
  @Column({ length: 25, default: 'PENDIENTE_VALIDACION' }) estado!: EstadoFirmanteTitulacion;
  @Column({ name: 'registrado_por_id', type: 'int' }) registradoPorId!: number;
  @ManyToOne(() => Usuario, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'registrado_por_id' }) registradoPor!: Usuario;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
}
