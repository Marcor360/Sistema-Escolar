import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('notificaciones')
export class Notificacion {
  @PrimaryGeneratedColumn() id: number;
  @Column() usuarioId: number;
  @Column({ length: 150 }) titulo: string;
  @Column({ length: 600 }) mensaje: string;
  @Column({ length: 30, default: 'GENERAL' }) tipo: 'GENERAL' | 'ACADEMICA' | 'FINANCIERA';
  @Column({ default: false }) leida: boolean;
  @CreateDateColumn() createdAt: Date;
}
