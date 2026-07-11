import {
  BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { JwtUser } from '../common/current-user.decorator';
import { Alumno } from '../entities/alumno.entity';
import { Grupo } from '../entities/grupo.entity';
import { Plantel } from '../entities/plantel.entity';
import { UsuarioPlantel } from '../entities/usuario-plantel.entity';
import { Usuario } from '../entities/usuario.entity';
import { ActualizarPlantelDto, CrearPlantelDto } from './planteles.dto';
import { ScopeService } from './scope.service';

@Injectable()
export class PlantelesService {
  constructor(
    @InjectRepository(Plantel) private readonly planteles: Repository<Plantel>,
    @InjectRepository(UsuarioPlantel) private readonly asignaciones: Repository<UsuarioPlantel>,
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    @InjectRepository(Alumno) private readonly alumnos: Repository<Alumno>,
    @InjectRepository(Grupo) private readonly grupos: Repository<Grupo>,
    private readonly scope: ScopeService,
  ) {}

  async mios(user: JwtUser) {
    const ids = await this.scope.plantelesDe(user);
    if (ids === null) return this.planteles.find({ where: { activo: true }, order: { nombre: 'ASC' } });
    if (ids.length === 0) return [];
    return this.planteles.find({ where: { id: In(ids), activo: true }, order: { nombre: 'ASC' } });
  }

  async listar(user: JwtUser) {
    const ids = await this.scope.resolverFiltro(user);
    return this.planteles.find({
      where: ids === null ? {} : { id: In(ids) },
      order: { nombre: 'ASC' },
    });
  }

  async detalle(id: number, user: JwtUser) {
    await this.scope.validarGestion(user, id);
    const plantel = await this.obtener(id);
    const [asignaciones, alumnos, grupos] = await Promise.all([
      this.asignaciones.find({ where: { plantelId: id, activo: true }, relations: { usuario: true } }),
      this.alumnos.count({ where: { plantelId: id, estatus: 'ACTIVO' } }),
      this.grupos.count({ where: { plantelId: id } }),
    ]);
    return {
      ...plantel,
      personal: asignaciones.map((a) => ({
        id: a.usuario.id,
        nombre: a.usuario.nombreCompleto,
        email: a.usuario.email,
        roles: a.usuario.roles.map((r) => r.clave),
      })),
      conteos: { alumnos, grupos },
    };
  }

  async crear(dto: CrearPlantelDto) {
    if (await this.planteles.findOne({ where: { clave: dto.clave } })) {
      throw new ConflictException('Ya existe un plantel con esa clave');
    }
    return this.planteles.save(this.planteles.create({
      ...dto,
      direccion: dto.direccion ?? null,
      municipio: dto.municipio ?? null,
      telefono: dto.telefono ?? null,
      directorUsuarioId: null,
    }));
  }

  async actualizar(id: number, dto: ActualizarPlantelDto) {
    const plantel = await this.obtener(id);
    Object.assign(plantel, dto);
    return this.planteles.save(plantel);
  }

  async asignarDirector(id: number, email: string, user: JwtUser) {
    await this.validarAdministracion(user, id);
    const [plantel, personal] = await Promise.all([this.obtener(id), this.obtenerPersonal(email)]);
    await this.asegurarAsignacion(personal.id, id);
    plantel.directorUsuarioId = personal.id;
    return this.planteles.save(plantel);
  }

  async agregarPersonal(id: number, email: string, user: JwtUser) {
    await this.validarAdministracion(user, id);
    await this.obtener(id);
    const personal = await this.obtenerPersonal(email);
    await this.asegurarAsignacion(personal.id, id);
    return { ok: true };
  }

  async quitarPersonal(id: number, usuarioId: number, user: JwtUser) {
    await this.validarAdministracion(user, id);
    const plantel = await this.obtener(id);
    if (plantel.directorUsuarioId === usuarioId) throw new BadRequestException('Primero asigna otro director');
    await this.asignaciones.delete({ usuarioId, plantelId: id });
    return { ok: true };
  }

  private async obtener(id: number) {
    const plantel = await this.planteles.findOne({ where: { id } });
    if (!plantel) throw new NotFoundException('Plantel no encontrado');
    return plantel;
  }

  private async obtenerPersonal(email: string) {
    const usuario = await this.usuarios.findOne({ where: { email, activo: true } });
    if (!usuario || usuario.roles.some((r) => r.clave === 'ALUMNO')) {
      throw new BadRequestException('El correo debe pertenecer a un usuario activo de personal');
    }
    const rolesPersonal = ['MAESTRO', 'ADMINISTRATIVO', 'FINANZAS', 'SUPERADMIN'];
    if (!usuario.roles.some((r) => rolesPersonal.includes(r.clave))) {
      throw new BadRequestException('El correo debe pertenecer a un usuario activo de personal');
    }
    return usuario;
  }

  private async asegurarAsignacion(usuarioId: number, plantelId: number) {
    const actual = await this.asignaciones.findOne({ where: { usuarioId, plantelId } });
    if (actual) {
      if (!actual.activo) await this.asignaciones.update({ usuarioId, plantelId }, { activo: true });
      return;
    }
    await this.asignaciones.save(this.asignaciones.create({ usuarioId, plantelId, activo: true }));
  }

  private async validarAdministracion(user: JwtUser, plantelId: number) {
    if (!user.roles.includes('SUPERADMIN') && !user.roles.includes('ADMINISTRATIVO')) {
      throw new ForbiddenException('Solo un administrativo puede gestionar el personal del plantel');
    }
    await this.scope.validarGestion(user, plantelId);
  }
}
