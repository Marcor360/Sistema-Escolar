import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';
import { Usuario } from './usuario.entity';
import { TipoImportacion } from '../importaciones/importaciones.dto';
@Entity('importacion_previews')
@Index('idx_importacion_actor_expira', ['actorId','expira'])
export class ImportacionPreview {
  @PrimaryColumn({ type: 'varchar', length: 36 }) id!: string;
  @Column({ type: 'int' }) actorId!: number;
  @ManyToOne(() => Usuario) @JoinColumn({ name: 'actor_id', foreignKeyConstraintName: 'fk_importacion_preview_actor' }) actor!: Usuario;
  @Column({ type: 'varchar', length: 15 }) tipo!: TipoImportacion;
  @Column({ type: 'datetime' }) expira!: Date;
}
@Entity('importacion_filas')
@Index('uq_importacion_fila', ['previewId','posicion'], { unique: true })
export class ImportacionFila {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'varchar', length: 36 }) previewId!: string;
  @ManyToOne(() => ImportacionPreview, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'preview_id', foreignKeyConstraintName: 'fk_importacion_fila_preview' }) preview!: ImportacionPreview;
  @Column({ type: 'int' }) posicion!: number;
  @Column({ type: 'varchar', length: 8000 }) contenido!: string;
}
