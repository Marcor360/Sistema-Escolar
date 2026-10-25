import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { decimalTransformer } from '../common/decimal.transformer';
import { CuotaProgramada } from '../finanzas/programaciones-persistidas.dto';

const transformadorCuotas = {
  to: (cuotas: CuotaProgramada[]) => JSON.stringify(cuotas),
  from: (valor: string): CuotaProgramada[] => JSON.parse(valor) as CuotaProgramada[],
};

@Entity('programaciones_cobro')
@Unique('uq_programacion_idempotencia', ['idempotencia'])
@Unique('uq_programacion_contexto', ['alumnoId', 'cicloId', 'periodoAcademicoId', 'conceptoId'])
export class ProgramacionCobro {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ length: 36 }) idempotencia!: string;
  @Column({ length: 64 }) peticionHash!: string;
  @Index('idx_programacion_alumno') @Column() alumnoId!: number;
  @Index('idx_programacion_plantel') @Column() plantelId!: number;
  @Column() cicloId!: number;
  @Column() periodoAcademicoId!: number;
  @Column() conceptoId!: number;
  @Column({ length: 16 }) modalidad!: 'SECUNDARIA' | 'BACHILLERATO' | 'SUPERIOR' | 'ADICIONAL';
  @Column('decimal', { precision: 12, scale: 2, transformer: decimalTransformer }) total!: number;
  @Column({ type: 'text', transformer: transformadorCuotas }) cuotas!: CuotaProgramada[];
  @Column() creadoPorId!: number;
  @CreateDateColumn() createdAt!: Date;
}
