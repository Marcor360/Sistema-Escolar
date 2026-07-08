import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Usuario } from '../entities/usuario.entity';
import { Rol } from '../entities/rol.entity';
import { ActualizarUsuarioDto, CrearUsuarioDto } from './usuarios.dto';
import { RolClave } from '../common/roles.decorator';

@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    @InjectRepository(Rol) private readonly roles: Repository<Rol>,
  ) {}

  listar() {
    return this.usuarios.find({ order: { id: 'DESC' } });
  }

  async obtener(id: number) {
    const usuario = await this.usuarios.findOne({ where: { id } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');
    return usuario;
  }

  /** Reutilizable por Alumnos/Docentes para crear la cuenta asociada. */
  async crear(dto: CrearUsuarioDto): Promise<Usuario> {
    const existe = await this.usuarios.findOne({ where: { email: dto.email }, withDeleted: true });
    if (existe) throw new ConflictException('El correo ya está registrado');

    const roles = await this.resolverRoles(dto.roles);
    const usuario = this.usuarios.create({
      email: dto.email,
      passwordHash: await bcrypt.hash(dto.password, 10),
      nombre: dto.nombre,
      apellidoPaterno: dto.apellidoPaterno,
      apellidoMaterno: dto.apellidoMaterno ?? null,
      telefono: dto.telefono ?? null,
      roles,
    });
    return this.usuarios.save(usuario);
  }

  async actualizar(id: number, dto: ActualizarUsuarioDto) {
    const usuario = await this.obtener(id);
    if (dto.password) usuario.passwordHash = await bcrypt.hash(dto.password, 10);
    if (dto.roles) usuario.roles = await this.resolverRoles(dto.roles);
    Object.assign(usuario, {
      nombre: dto.nombre ?? usuario.nombre,
      apellidoPaterno: dto.apellidoPaterno ?? usuario.apellidoPaterno,
      apellidoMaterno: dto.apellidoMaterno ?? usuario.apellidoMaterno,
      telefono: dto.telefono ?? usuario.telefono,
      activo: dto.activo ?? usuario.activo,
    });
    return this.usuarios.save(usuario);
  }

  async desactivar(id: number) {
    await this.obtener(id);
    await this.usuarios.update(id, { activo: false });
    return { ok: true };
  }

  private async resolverRoles(claves: RolClave[]): Promise<Rol[]> {
    // Regla del dominio: ALUMNO es excluyente con cualquier rol de staff
    if (claves.includes('ALUMNO') && claves.length > 1) {
      throw new ConflictException('El rol ALUMNO no puede combinarse con roles de personal');
    }
    return this.roles.find({ where: { clave: In(claves) } });
  }
}
