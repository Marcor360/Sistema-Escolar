import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { EgresoAlumno } from './egreso-alumno.entity';
import { Usuario } from './usuario.entity';

@Entity('egreso_documentos')
@Index('idx_egreso_documentos_tipo', ['egresoId', 'tipo', 'id'])
export class EgresoDocumento {
  @PrimaryGeneratedColumn() id!: number;
  @Column() egresoId!: number;
  @ManyToOne(() => EgresoAlumno) @JoinColumn({ name: 'egreso_id' }) egreso!: EgresoAlumno;
  @Column() actorId!: number;
  @ManyToOne(() => Usuario) @JoinColumn({ name: 'actor_id' }) actor!: Usuario;
  @Column({ length: 24 }) tipo!: string;
  @Column({ length: 600 }) detalle!: string;
  @Column({ length: 64 }) contexto!: string;
  @Column({ length: 64 }) sha256!: string;
  @Column({ length: 64, unique: true }) clave!: string;
  @Column({ length: 40 }) mime!: string;
  contenido?: string;
  instantanea?: string;
  @CreateDateColumn() createdAt!: Date;
}

@Entity('egreso_documento_partes')
@Index('uq_egreso_documento_partes', ['documentoId', 'tipo', 'orden'], { unique: true })
export class EgresoDocumentoParte {
  @PrimaryGeneratedColumn() id!: number;
  @Column() documentoId!: number;
  @ManyToOne(() => EgresoDocumento) @JoinColumn({ name: 'documento_id' }) documento!: EgresoDocumento;
  @Column({ length: 12 }) tipo!: 'CONTENIDO' | 'INSTANTANEA';
  @Column() orden!: number;
  @Column({ type: 'text' }) datos!: string;
}
