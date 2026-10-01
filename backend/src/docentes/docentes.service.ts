import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Docente } from '../entities/docente.entity';
import { UsuariosService } from '../usuarios/usuarios.service';
import { ActualizarDocenteDto, CrearDocenteDto, ListarDocentesDto } from './docentes.dto';
import { UsuarioPlantel } from '../entities/usuario-plantel.entity';
import { ScopeService } from '../planteles/scope.service';
import { JwtUser } from '../common/current-user.decorator';
import { In } from 'typeorm';

@Injectable()
export class DocentesService {
  constructor(
    @InjectRepository(Docente) private readonly docentes: Repository<Docente>,
    @InjectRepository(UsuarioPlantel) private readonly asignaciones: Repository<UsuarioPlantel>,
    private readonly usuarios: UsuariosService,
    private readonly scope: ScopeService,
    private readonly dataSource: DataSource,
  ) {}

  async listar(user: JwtUser, query: ListarDocentesDto) {
    const pagina = query.pagina || 1;
    const porPagina = query.porPagina || 20;
    const planteles = await this.scope.resolverFiltro(user, query.plantelId);
    const qb = this.docentes.createQueryBuilder('d').innerJoinAndSelect('d.usuario', 'u');
    if (planteles !== null) qb.andWhere(
      'EXISTS (SELECT 1 FROM usuario_planteles up WHERE up.usuario_id = u.id AND up.activo = :activa AND up.plantel_id IN (:...planteles))',
      { activa: true, planteles },
    );
    const [docentes, total] = await qb
      .orderBy('d.id', 'DESC')
      .skip((pagina - 1) * porPagina)
      .take(porPagina)
      .getManyAndCount();
    const todasLasAsignaciones = docentes.length ? await this.asignaciones.find({
      where: { usuarioId: In(docentes.map((d) => d.usuarioId)), activo: true },
    }) : [];
    const asignaciones = planteles === null
      ? todasLasAsignaciones
      : todasLasAsignaciones.filter((a) => planteles.includes(a.plantelId));
    const datos = docentes.map((d) => this.proyectarDocente(d, {
      planteles: asignaciones.filter((a) => a.usuarioId === d.usuarioId).map((a) => a.plantel.nombre),
    }));
    return { datos, total, pagina, porPagina };
  }

  async obtener(id: number, user?: JwtUser, exigirTodosLosPlanteles = false) {
    const docente = await this.docentes.findOne({ where: { id } });
    if (!docente) throw new NotFoundException('Docente no encontrado');
    if (user) await this.validarAlcanceDocente(docente.usuarioId, user, exigirTodosLosPlanteles);
    return docente;
  }

  async obtenerParaApi(id: number, user: JwtUser) {
    return this.proyectarDocente(await this.obtener(id, user));
  }

  private async validarAlcanceDocente(
    usuarioId: number, user: JwtUser, exigirTodosLosPlanteles = false,
  ): Promise<void> {
    if (user.roles.includes('SUPERADMIN')) return;
    const permitidos = await this.scope.plantelesDe(user);
    const asignaciones = await this.asignaciones.find({ where: { usuarioId, activo: true } });
    if (permitidos === null) return;
    if (exigirTodosLosPlanteles && asignaciones.some((a) => !permitidos.includes(a.plantelId))) {
      throw new ForbiddenException('No puedes modificar un docente asignado a planteles fuera de tu alcance');
    }
    if (asignaciones.some((a) => permitidos.includes(a.plantelId))) return;
    throw new ForbiddenException('El docente no pertenece a un plantel dentro de tu alcance');
  }

  async obtenerPorUsuario(usuarioId: number) {
    const docente = await this.docentes.findOne({ where: { usuarioId } });
    if (!docente) throw new NotFoundException('El usuario no tiene expediente de docente');
    return docente;
  }

  async crear(dto: CrearDocenteDto, user: JwtUser) {
    const plantelIds = [...new Set(dto.plantelIds)];
    for (const plantelId of plantelIds) await this.scope.validarGestion(user, plantelId);
    const existe = await this.docentes.findOne({ where: { numEmpleado: dto.numEmpleado }, withDeleted: true });
    if (existe) throw new ConflictException('El número de empleado ya está registrado');

    return this.dataSource.transaction(async (manager) => {
      const usuario = await this.usuarios.crear({
        email: dto.email,
        password: dto.password,
        nombre: dto.nombre,
        apellidoPaterno: dto.apellidoPaterno,
        apellidoMaterno: dto.apellidoMaterno,
        telefono: dto.telefono,
        roles: ['MAESTRO'],
      }, manager);
      const docentes = manager.getRepository(Docente);
      const docente = await docentes.save(docentes.create({
        usuarioId: usuario.id,
        numEmpleado: dto.numEmpleado,
        cedulaProfesional: dto.cedulaProfesional ?? null,
        especialidad: dto.especialidad ?? null,
      }));
      const asignaciones = manager.getRepository(UsuarioPlantel);
      await asignaciones.save(plantelIds.map((plantelId) => asignaciones.create({
        usuarioId: usuario.id, plantelId, activo: true,
      })));
      return this.proyectarDocente(docente);
    });
  }

  async actualizar(id: number, dto: ActualizarDocenteDto, user: JwtUser) {
    return this.dataSource.transaction(async (manager) => {
      const docentes = manager.getRepository(Docente);
      const docente = await docentes.findOne({ where: { id } });
      if (!docente) throw new NotFoundException('Docente no encontrado');
      await this.validarAlcanceDocente(docente.usuarioId, user, true);
      if (dto.nombre || dto.apellidoPaterno || dto.apellidoMaterno || dto.telefono) {
        await this.usuarios.actualizar(docente.usuarioId, {
          nombre: dto.nombre,
          apellidoPaterno: dto.apellidoPaterno,
          apellidoMaterno: dto.apellidoMaterno,
          telefono: dto.telefono,
        }, manager);
      }
      Object.assign(docente, {
        cedulaProfesional: dto.cedulaProfesional ?? docente.cedulaProfesional,
        especialidad: dto.especialidad ?? docente.especialidad,
        estatus: dto.estatus ?? docente.estatus,
      });
      return this.proyectarDocente(await docentes.save(docente));
    });
  }

  async baja(id: number, user: JwtUser) {
    return this.dataSource.transaction(async (manager) => {
      const docentes = manager.getRepository(Docente);
      const docente = await docentes.findOne({ where: { id } });
      if (!docente) throw new NotFoundException('Docente no encontrado');
      await this.validarAlcanceDocente(docente.usuarioId, user, true);
      docente.estatus = 'BAJA';
      await docentes.save(docente);
      await docentes.softDelete(id);
      await manager.getRepository(UsuarioPlantel).update(
        { usuarioId: docente.usuarioId, activo: true }, { activo: false },
      );
      await this.usuarios.actualizar(docente.usuarioId, { activo: false }, manager);
      return { ok: true };
    });
  }

  private proyectarDocente(docente: Docente, extra: { planteles?: string[] } = {}) {
    return {
      id: docente.id,
      numEmpleado: docente.numEmpleado,
      cedulaProfesional: docente.cedulaProfesional,
      especialidad: docente.especialidad,
      estatus: docente.estatus,
      ...(docente.usuario ? {
        usuario: {
          id: docente.usuario.id,
          email: docente.usuario.email,
          nombre: docente.usuario.nombre,
          apellidoPaterno: docente.usuario.apellidoPaterno,
          apellidoMaterno: docente.usuario.apellidoMaterno,
          telefono: docente.usuario.telefono,
        },
      } : {}),
      ...extra,
    };
  }
}
