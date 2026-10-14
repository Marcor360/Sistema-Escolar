import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Plantel } from './plantel.entity';
@Entity('biblioteca_carpetas')
@Index('idx_biblioteca_carpeta_plantel', ['plantelId', 'padreId'])
export class BibliotecaCarpeta {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'int' }) plantelId!: number;
  @ManyToOne(() => Plantel)
  @JoinColumn({ name: 'plantel_id', foreignKeyConstraintName: 'fk_biblioteca_carpeta_plantel' })
  plantel!: Plantel;
  @Column({ type: 'int', nullable: true }) padreId!: number | null;
  @ManyToOne(() => BibliotecaCarpeta, { nullable: true })
  @JoinColumn({ name: 'padre_id', foreignKeyConstraintName: 'fk_biblioteca_carpeta_padre' })
  padre!: BibliotecaCarpeta | null;
  @Column({ length: 120 }) nombre!: string;
}
@Entity('biblioteca_archivos')
@Index('idx_biblioteca_archivo_plantel', ['plantelId', 'carpetaId'])
export class BibliotecaArchivo {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'int' }) plantelId!: number;
  @ManyToOne(() => Plantel)
  @JoinColumn({ name: 'plantel_id', foreignKeyConstraintName: 'fk_biblioteca_archivo_plantel' })
  plantel!: Plantel;
  @Column({ type: 'int' }) carpetaId!: number;
  @ManyToOne(() => BibliotecaCarpeta)
  @JoinColumn({ name: 'carpeta_id', foreignKeyConstraintName: 'fk_biblioteca_archivo_carpeta' })
  carpeta!: BibliotecaCarpeta;
  @Column({ length: 150 }) titulo!: string;
  @Column({ length: 200 }) archivoNombre!: string;
  @Column({ length: 200 }) archivoRuta!: string;
  @Column({ length: 100 }) mime!: string;
  @Column({ type: 'int' }) bytes!: number;
  @Column({ length: 20 }) categoria!: 'FOTO' | 'LOGO' | 'CALENDARIO' | 'DOCUMENTO';
  @Column({ type: 'int' }) creadoPorId!: number;
  @Column({ type: 'datetime' }) creadoAt!: Date;
}
