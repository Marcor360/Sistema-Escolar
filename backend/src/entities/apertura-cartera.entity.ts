import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique, Index } from 'typeorm';
import { Alumno } from './alumno.entity';
import { Plantel } from './plantel.entity';
import { CicloEscolar } from './ciclo-escolar.entity';
import { SolicitudGrupoRegular } from './solicitud-grupo-regular.entity';
import { Usuario } from './usuario.entity';
export interface ConceptoApertura { conceptoId: number; clave: string; nombre: string; tipo: string; monto: number; periodo: string; fechaVencimiento: string; cargoId?: number }
@Entity('aperturas_cartera')
@Unique('uq_apertura_idempotencia', ['idempotencia'])
@Unique('uq_apertura_alumno_ciclo', ['alumnoId','cicloId'])
@Index('uq_apertura_solicitud', ['solicitudId'], { unique: true, where: 'solicitud_id IS NOT NULL' })
export class AperturaCartera {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ length: 36 }) idempotencia!: string;
  @Column({ length: 64 }) peticionHash!: string;
  @Column() alumnoId!: number;
  @ManyToOne(() => Alumno) @JoinColumn({ name: 'alumno_id' }) alumno!: Alumno;
  @Column() plantelId!: number;
  @ManyToOne(() => Plantel) @JoinColumn({ name: 'plantel_id' }) plantel!: Plantel;
  @Column() cicloId!: number;
  @ManyToOne(() => CicloEscolar) @JoinColumn({ name: 'ciclo_id' }) ciclo!: CicloEscolar;
  @Column({ type: 'int', nullable: true }) solicitudId!: number | null;
  @ManyToOne(() => SolicitudGrupoRegular, { nullable: true }) @JoinColumn({ name: 'solicitud_id' }) solicitud!: SolicitudGrupoRegular | null;
  @Column() creadoPorId!: number;
  @ManyToOne(() => Usuario) @JoinColumn({ name: 'creado_por_id' }) creadoPor!: Usuario;
  @Column({ type: String, length: 12, default: 'PENDIENTE' }) estado!: 'PENDIENTE' | 'ABIERTA' | 'PAUSA';
  @Column({ type: 'text', nullable: true }) contextoJson!: string | null;
  @Column({ type: 'text', transformer: { to: (v: ConceptoApertura[]) => JSON.stringify(v), from: (v: string) => JSON.parse(v) as ConceptoApertura[] } }) conceptos!: ConceptoApertura[];
  @CreateDateColumn() createdAt!: Date;
}
