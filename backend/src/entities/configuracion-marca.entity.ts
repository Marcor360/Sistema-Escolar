import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** Fila única (id = 1): identidad visual configurable de la institución. */
@Entity('configuracion_marca')
export class ConfiguracionMarca {
  @PrimaryColumn() id!: number;
  @Column({ length: 150 }) nombreInstitucion!: string;
  @Column({ length: 150, default: 'Sistema Escolar Administrativo' }) nombreAdministrativo!: string;
  @Column({ length: 150, default: 'Sistema Escolar Portal Alumno' }) nombrePortalAlumno!: string;
  @Column({ length: 10 }) nombreCorto!: string;
  @Column({ type: String, length: 255, nullable: true }) logoUrl!: string | null;
  @Column({ name: 'favicon_administrativo_url', type: String, length: 255, nullable: true }) faviconAdministrativoUrl!: string | null;
  @Column({ name: 'favicon_alumno_url', type: String, length: 255, nullable: true }) faviconAlumnoUrl!: string | null;
  @Column({ name: 'logo_alumno_url', type: String, length: 255, nullable: true }) logoAlumnoUrl!: string | null;
  @Column({ type: 'char', length: 7 }) colorPrimario!: string;
  @Column({ type: 'char', length: 7 }) colorAcento!: string;
  @Column({ length: 180, default: '' }) mensajeBienvenida!: string;
  @Column({ length: 10, default: 'NORMAL' }) tamanoLogo!: 'NORMAL' | 'GRANDE';
  @Column({ type: String, length: 255, nullable: true }) fondoAlumnoUrl!: string | null;
  @Column({ type: String, length: 180, nullable: true }) bienvenidaAlumno!: string | null;
  @Column({ type: String, length: 420, nullable: true }) descripcionAlumno!: string | null;
  @Column({ type: String, length: 360, nullable: true }) avisoAlumno!: string | null;
  @Column({ type: String, length: 180, nullable: true }) contactoAlumno!: string | null;
  @Column({ type: String, length: 500, nullable: true }) privacidadAlumno!: string | null;
  @Column({ type: String, length: 500, nullable: true }) reglamentoAlumno!: string | null;
  @Column({ type: String, length: 500, nullable: true }) sitioAlumno!: string | null;
  @Column({ type: String, length: 120, nullable: true }) tituloBoleta!: string | null;
  @Column({ type: String, length: 480, nullable: true }) pieBoleta!: string | null;
  @UpdateDateColumn() actualizadoEn!: Date;
}
