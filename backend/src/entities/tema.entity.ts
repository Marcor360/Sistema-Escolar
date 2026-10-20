import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { GrupoMateria } from './grupo-materia.entity';
import { Usuario } from './usuario.entity';

@Entity('temas')
@Unique('uq_tema_clase_indice', ['grupoMateriaId', 'indice'])
@Index('idx_tema_publicacion', ['grupoMateriaId', 'estado', 'desde'])
export class Tema {
  @PrimaryGeneratedColumn() id!: number;
  @Column() grupoMateriaId!: number;
  @ManyToOne(() => GrupoMateria) @JoinColumn({ name: 'grupo_materia_id' }) grupoMateria!: GrupoMateria;
  @Column() indice!: number;
  @Column({ length: 150 }) titulo!: string;
  @Column({ type: 'text' }) contenido!: string;
  @Column({ type: String, length: 12, default: 'BORRADOR' }) estado!: 'BORRADOR' | 'PUBLICADO' | 'CANCELADO';
  @Column({ type: 'datetime', nullable: true }) desde!: Date | null;
  @Column({ type: 'datetime', nullable: true }) hasta!: Date | null;
  @Column({ type: 'int', nullable: true }) parcial!: number | null;
  @Column({ type: String, length: 1000, nullable: true }) enlace!: string | null;
  @Column({ default: 1 }) revision!: number;
  @Column() creadorId!: number;
  @ManyToOne(() => Usuario) @JoinColumn({ name: 'creador_id' }) creador!: Usuario;
  @CreateDateColumn() createdAt!: Date;
}

@Entity('tema_adjuntos')
@Index('idx_tema_adjunto', ['temaId', 'activo'])
export class TemaAdjunto {
  @PrimaryGeneratedColumn() id!: number;
  @Column() temaId!: number;
  @ManyToOne(() => Tema) @JoinColumn({ name: 'tema_id' }) tema!: Tema;
  @Column({ length: 200 }) archivoNombre!: string;
  @Column({ length: 300 }) archivoRuta!: string;
  @Column({ length: 100 }) mime!: string;
  @Column() tamanoKb!: number;
  @Column({ default: true }) activo!: boolean;
  @CreateDateColumn() createdAt!: Date;
}

@Entity('tema_revisiones')
@Unique('uq_tema_revision', ['temaId', 'revision'])
export class TemaRevision {
  @PrimaryGeneratedColumn() id!: number;
  @Column() temaId!: number;
  @ManyToOne(() => Tema) @JoinColumn({ name: 'tema_id' }) tema!: Tema;
  @Column() revision!: number;
  @Column() usuarioId!: number;
  @ManyToOne(() => Usuario) @JoinColumn({ name: 'usuario_id' }) usuario!: Usuario;
  @Column({ length: 40 }) accion!: string;
  @Column({ type: 'text' }) detalle!: string;
  @CreateDateColumn() fecha!: Date;
}
