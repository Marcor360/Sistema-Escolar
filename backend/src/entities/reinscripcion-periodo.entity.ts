import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Alumno } from './alumno.entity';
import { Usuario } from './usuario.entity';
import { Inscripcion } from './inscripcion.entity';
import { PeriodoAcademico } from './periodo-academico.entity';
import { Plantel } from './plantel.entity';
import { CicloEscolar } from './ciclo-escolar.entity';
import { Grupo } from './grupo.entity';
@Entity('autorizaciones_reinscripcion')
export class AutorizacionReinscripcion {
  @PrimaryGeneratedColumn() id!: number;
  @Column() alumnoId!: number;
  @ManyToOne(() => Alumno) @JoinColumn({ name: 'alumno_id' }) alumno!: Alumno;
  @Column() plantelId!: number;
  @ManyToOne(() => Plantel) @JoinColumn({ name: 'plantel_id' }) plantel!: Plantel;
  @Column() financieroId!: number;
  @ManyToOne(() => Usuario) @JoinColumn({ name: 'financiero_id' }) financiero!: Usuario;
  @Column({ length: 64 }) cotizacion!: string;
  @Column('text') peticionJson!: string;
  @Column('text') snapshotJson!: string;
  @Column({ length: 12, default: 'AUTORIZADA' }) estado!: 'AUTORIZADA' | 'UTILIZADA' | 'ANULADA';
  @Column() venceAt!: Date;
  @CreateDateColumn() createdAt!: Date;
}
@Entity('reinscripciones_periodo')
@Index('idx_reinscripcion_cohorte', ['plantelId', 'cicloId', 'periodoAcademicoId', 'turno', 'estado'])
export class ReinscripcionPeriodo {
  @PrimaryGeneratedColumn() id!: number;
  @Index('uq_reinscripcion_idempotencia', { unique: true }) @Column({ length: 36 }) idempotencia!: string;
  @Column({ length: 64 }) peticionHash!: string;
  @Index('uq_reinscripcion_origen', { unique: true, where: 'clave_origen IS NOT NULL' })
  @Column({ type: String, length: 50, nullable: true })
  claveOrigen!: string | null;
  @Column() alumnoId!: number;
  @ManyToOne(() => Alumno) @JoinColumn({ name: 'alumno_id' }) alumno!: Alumno;
  @Column() plantelId!: number;
  @ManyToOne(() => Plantel) @JoinColumn({ name: 'plantel_id' }) plantel!: Plantel;
  @Column() cicloId!: number;
  @ManyToOne(() => CicloEscolar) @JoinColumn({ name: 'ciclo_id' }) ciclo!: CicloEscolar;
  @Column() origenInscripcionId!: number;
  @ManyToOne(() => Inscripcion) @JoinColumn({ name: 'origen_inscripcion_id' }) origen!: Inscripcion;
  @Column() periodoAcademicoId!: number;
  @ManyToOne(() => PeriodoAcademico) @JoinColumn({ name: 'periodo_academico_id' }) periodo!: PeriodoAcademico;
  @Column() nivelId!: number;
  @Column() carreraId!: number;
  @Column({ length: 10 }) turno!: 'MATUTINO' | 'VESPERTINO';
  @Column({ type: 'int', nullable: true }) grupoId!: number | null;
  @ManyToOne(() => Grupo) @JoinColumn({ name: 'grupo_id' }) grupo!: Grupo | null;
  @Column({ type: 'int', nullable: true }) inscripcionDestinoId!: number | null;
  @ManyToOne(() => Inscripcion) @JoinColumn({ name: 'inscripcion_destino_id' }) inscripcionDestino!: Inscripcion | null;
  @Index('uq_reinscripcion_autorizacion', { unique: true }) @Column() autorizacionId!: number;
  @ManyToOne(() => AutorizacionReinscripcion)
  @JoinColumn({ name: 'autorizacion_id' })
  autorizacion!: AutorizacionReinscripcion;
  @Column() creadoPorId!: number;
  @ManyToOne(() => Usuario) @JoinColumn({ name: 'creado_por_id' }) creadoPor!: Usuario;
  @Column({ length: 20, default: 'PENDIENTE' }) estado!: 'PENDIENTE' | 'CONFIRMADA' | 'REQUIERE_REVISION' | 'ANULADA';
  @Column({ length: 64 }) academicoHash!: string;
  @Column('text') snapshotJson!: string;
  @Column('text') cargosJson!: string;
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
}
