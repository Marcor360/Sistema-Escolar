import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Usuario } from '../entities/usuario.entity';
import { Rol } from '../entities/rol.entity';
import { ActualizarUsuarioDto, CrearUsuarioDto } from './usuarios.dto';
import { RolClave } from '../common/roles.decorator';
import { Alumno } from '../entities/alumno.entity';
import { Docente } from '../entities/docente.entity';
import { UsuarioPlantel } from '../entities/usuario-plantel.entity';
import { JwtUser } from '../common/current-user.decorator';
import { ScopeService } from '../planteles/scope.service';
import { ListadoUsuariosDto } from './usuarios.dto';

@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    @InjectRepository(Rol) private readonly roles: Repository<Rol>,
    @InjectRepository(Alumno) private readonly alumnos: Repository<Alumno>,
    @InjectRepository(Docente) private readonly docentes: Repository<Docente>,
    @InjectRepository(UsuarioPlantel) private readonly asignaciones: Repository<UsuarioPlantel>,
    private readonly scope: ScopeService,
  ) {}

  listar() {
    return this.usuarios.find({ order: { id: 'DESC' } });
  }

  async listado(query: ListadoUsuariosDto, user: JwtUser) {
    const pagina = query.pagina || 1;
    const porPagina = Math.min(query.porPagina || 20, 100);
    const maestroPuro = user.roles.includes('MAESTRO') &&
      !user.roles.some((r) => ['SUPERADMIN', 'ADMINISTRATIVO', 'FINANZAS'].includes(r));
    if (maestroPuro && query.tipo !== 'ALUMNO') {
      throw new ForbiddenException('Un maestro solo puede consultar alumnos de sus grupos');
    }
    if (query.tipo === 'ALUMNO') return this.listarAlumnos(query, user, maestroPuro, pagina, porPagina);
    if (query.tipo === 'DOCENTE') return this.listarDocentes(query, user, pagina, porPagina);
    return this.listarAdministrativos(query, user, pagina, porPagina);
  }

  private async listarAlumnos(
    query: ListadoUsuariosDto, user: JwtUser, maestroPuro: boolean, pagina: number, porPagina: number,
  ) {
    const qb = this.alumnos.createQueryBuilder('a')
      .innerJoinAndSelect('a.usuario', 'u')
      .leftJoinAndSelect('a.plantel', 'p');
    if (maestroPuro) {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM inscripciones i INNER JOIN grupo_materias gm ON gm.grupo_id = i.grupo_id INNER JOIN docentes d ON d.id = gm.docente_id WHERE i.alumno_id = a.id AND i.estatus = :activa AND d.usuario_id = :actorId)',
        { activa: 'ACTIVA', actorId: user.sub },
      );
      if (query.plantelId) qb.andWhere('a.plantel_id = :plantelId', { plantelId: query.plantelId });
    } else {
      const planteles = await this.scope.resolverFiltro(user, query.plantelId);
      if (planteles !== null) qb.andWhere('a.plantel_id IN (:...planteles)', { planteles });
    }
    this.aplicarBusqueda(qb, query.buscar, 'a.matricula');
    const [filas, total] = await qb.orderBy('a.id', 'DESC').skip((pagina - 1) * porPagina).take(porPagina).getManyAndCount();
    return { datos: filas.map((a) => ({
      id: a.id, matricula: a.matricula, nombre: a.usuario.nombreCompleto,
      correo: a.usuario.email, plantel: a.plantel?.nombre ?? null, estatus: a.estatus,
    })), total, pagina, porPagina };
  }

  private async listarDocentes(query: ListadoUsuariosDto, user: JwtUser, pagina: number, porPagina: number) {
    const planteles = await this.scope.resolverFiltro(user, query.plantelId);
    const qb = this.docentes.createQueryBuilder('d').innerJoinAndSelect('d.usuario', 'u');
    if (planteles !== null) qb.andWhere(
      'EXISTS (SELECT 1 FROM usuario_planteles up WHERE up.usuario_id = u.id AND up.activo = :activa AND up.plantel_id IN (:...planteles))',
      { activa: true, planteles },
    );
    this.aplicarBusqueda(qb, query.buscar, 'd.num_empleado');
    const [filas, total] = await qb.orderBy('d.id', 'DESC').skip((pagina - 1) * porPagina).take(porPagina).getManyAndCount();
    const nombres = await this.plantelesPorUsuario(filas.map((d) => d.usuarioId));
    return { datos: filas.map((d) => ({
      id: d.id, numEmpleado: d.numEmpleado, nombre: d.usuario.nombreCompleto,
      correo: d.usuario.email, planteles: nombres.get(d.usuarioId) ?? [], estatus: d.estatus,
    })), total, pagina, porPagina };
  }

  private async listarAdministrativos(query: ListadoUsuariosDto, user: JwtUser, pagina: number, porPagina: number) {
    const planteles = await this.scope.resolverFiltro(user, query.plantelId);
    const qb = this.usuarios.createQueryBuilder('u')
      .innerJoin('u.roles', 'rolFiltro', 'rolFiltro.clave IN (:...staff)', { staff: ['ADMINISTRATIVO', 'FINANZAS', 'SUPERADMIN'] })
      .leftJoinAndSelect('u.roles', 'roles')
      .distinct(true);
    if (planteles !== null) qb.andWhere(
      'EXISTS (SELECT 1 FROM usuario_planteles up WHERE up.usuario_id = u.id AND up.activo = :activa AND up.plantel_id IN (:...planteles))',
      { activa: true, planteles },
    );
    this.aplicarBusqueda(qb, query.buscar);
    const [filas, total] = await qb.orderBy('u.id', 'DESC').skip((pagina - 1) * porPagina).take(porPagina).getManyAndCount();
    const nombres = await this.plantelesPorUsuario(filas.map((u) => u.id));
    return { datos: filas.map((u) => ({
      id: u.id, nombre: u.nombreCompleto, correo: u.email,
      roles: u.roles.map((r) => r.clave), planteles: nombres.get(u.id) ?? [], activo: u.activo,
    })), total, pagina, porPagina };
  }

  private aplicarBusqueda(qb: any, buscar?: string, extra?: string) {
    if (!buscar?.trim()) return;
    const campos = ['u.nombre', 'u.apellido_paterno', 'u.email', ...(extra ? [extra] : [])];
    qb.andWhere(`(${campos.map((campo) => `${campo} LIKE :buscar`).join(' OR ')})`, { buscar: `%${buscar.trim()}%` });
  }

  private async plantelesPorUsuario(usuarioIds: number[]) {
    const mapa = new Map<number, string[]>();
    if (!usuarioIds.length) return mapa;
    const filas = await this.asignaciones.find({ where: { usuarioId: In(usuarioIds), activo: true } });
    for (const fila of filas) mapa.set(fila.usuarioId, [...(mapa.get(fila.usuarioId) ?? []), fila.plantel.nombre]);
    return mapa;
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
