import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('ciclos_escolares')
export class CicloEscolar {
  @PrimaryGeneratedColumn() id: number;
  @Column({ length: 20, unique: true }) clave: string;
  @Column({ length: 80 }) nombre: string;
  @Column({ type: 'date' }) fechaInicio: string;
  @Column({ type: 'date' }) fechaFin: string;
  @Column({ default: false }) activo: boolean;
  /** Vínculo con la base certweb para la migración inicial (ETL); no se expone en la API pública. */
  @Column({ type: 'bigint', nullable: true }) legacyId: string | null;
}
