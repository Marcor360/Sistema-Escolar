import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { GrupoMateria } from './grupo-materia.entity';

@Entity('materiales')
export class Material {
  @PrimaryGeneratedColumn() id: number;
  @Column() grupoMateriaId: number;
  @ManyToOne(() => GrupoMateria, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'grupo_materia_id' })
  grupoMateria: GrupoMateria;
  @Column({ length: 150 }) titulo: string;
  @Column({ length: 200 }) archivoNombre: string;
  @Column({ length: 300 }) archivoRuta: string;
  @Column({ length: 100, nullable: true }) mime: string | null;
  @Column({ default: 0 }) tamanoKb: number;
  @CreateDateColumn() createdAt: Date;
}
