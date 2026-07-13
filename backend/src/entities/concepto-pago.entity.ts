import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { decimalTransformer } from '../common/decimal.transformer';

export type ConceptoTipo = 'INSCRIPCION' | 'COLEGIATURA' | 'RECARGO' | 'DESCUENTO' | 'BECA' | 'OTRO';

@Entity('conceptos_pago')
export class ConceptoPago {
  @PrimaryGeneratedColumn() id: number;
  @Column({ length: 20, unique: true }) clave: string;
  @Column({ length: 120 }) nombre: string;
  @Column({ length: 20 }) tipo: ConceptoTipo;
  @Column('decimal', { precision: 12, scale: 2, default: 0, transformer: decimalTransformer })
  montoBase: number;
  @Column({ default: true }) activo: boolean;
  /** Vínculo con la base certweb para la migración inicial (ETL); no se expone en la API pública. */
  @Column({ type: 'bigint', nullable: true }) legacyId: string | null;
}
