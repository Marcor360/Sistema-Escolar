import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** Fila única (id = 1): identidad visual configurable de la institución. */
@Entity('configuracion_marca')
export class ConfiguracionMarca {
  @PrimaryColumn() id: number;
  @Column({ length: 150 }) nombreInstitucion: string;
  @Column({ length: 10 }) nombreCorto: string;
  @Column({ length: 255, nullable: true }) logoUrl: string | null;
  @Column({ length: 7 }) colorPrimario: string;
  @Column({ length: 7 }) colorAcento: string;
  @UpdateDateColumn() actualizadoEn: Date;
}
