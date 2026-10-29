import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('historial_roles_usuario')
export class HistorialRolesUsuario {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ name: 'usuario_id', type: 'int' }) usuarioId!: number;
  @Column({ name: 'actor_id', type: 'int' }) actorId!: number;
  @Column({ name: 'roles_antes', length: 200 }) rolesAntes!: string;
  @Column({ name: 'roles_despues', length: 200 }) rolesDespues!: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
}
