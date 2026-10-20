import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Usuario } from './usuario.entity';
@Entity('aceptaciones_institucionales')
@Index('uq_aceptacion_documento_version', ['usuarioId','documento','versionDocumento'], { unique: true })
export class AceptacionInstitucional {
  @PrimaryColumn({ length: 36 }) id!: string;
  @Column({ type: 'int' }) usuarioId!: number;
  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'usuario_id' }) usuario!: Usuario;
  @Column({ length: 32 }) documento!: 'REGLAMENTO_ACADEMICO' | 'POLITICAS_INSTITUCIONALES';
  @Column({ length: 80 }) versionDocumento!: string;
  @Column({ type: Date }) aceptadoEn!: Date;
}
