import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
@Entity('cuentas_deposito')
export class CuentaDeposito {
  @PrimaryColumn() id!: number;
  @Column({ length: 12, default: 'BBVA' }) banco!: 'BBVA';
  @Column({ length: 150 }) titular!: string;
  @Column({ length: 10 }) numeroCuenta!: string;
  @Column({ type: String, length: 18, nullable: true }) clabe!: string | null;
  @Column({ default: true }) activo!: boolean;
  @UpdateDateColumn() actualizadoEn!: Date;
}
