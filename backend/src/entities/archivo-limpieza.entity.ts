import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
@Entity('archivos_limpieza') @Index('uq_archivo_limpieza_nombre', ['nombre'], { unique: true })
export class ArchivoLimpieza {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: String, length: 200 }) nombre: string;
  @Column({ type: 'int', default: 0 }) intentos: number;
  @Column({ type: Date }) proximoIntento: Date;
  @Column({ type: String, length: 100, nullable: true }) error: string | null;
}
