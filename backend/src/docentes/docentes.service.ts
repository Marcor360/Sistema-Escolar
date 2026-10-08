import { BitacoraAcademica } from '../entities/bitacora-academica.entity';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Plantel } from '../entities/plantel.entity';
import { GrupoMateria } from '../entities/grupo-materia.entity';
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
      'EXISTS (SELECT 1 FROM usuario_planteles up WHERE up.usuario_id = u.id AND (up.activo = :activa OR d.estatus = :baja) AND up.plantel_id IN (:...planteles))',
      { activa: true, baja: 'BAJA', planteles },
    );
    if (query.buscar?.trim()) qb.andWhere('(d.num_empleado LIKE :buscar OR u.nombre LIKE :buscar OR u.apellido_paterno LIKE :buscar)', { buscar: `%${query.buscar.trim()}%` });
    const [docentes, total] = await qb
      .orderBy('d.id', 'DESC')
      .skip((pagina - 1) * porPagina)
      .take(porPagina)
      .getManyAndCount();
    const todasLasAsignaciones = docentes.length ? await this.asignaciones.find({
      where: { usuarioId: In(docentes.map((d) => d.usuarioId)) },
    }) : [];
    const asignaciones = planteles === null
      ? todasLasAsignaciones
      : todasLasAsignaciones.filter((a) => planteles.includes(a.plantelId));
    const datos = docentes.map((d) => this.proyectarDocente(d, {
      planteles: asignaciones.filter((a) => a.usuarioId === d.usuarioId && (a.activo || d.estatus === 'BAJA')).map((a) => a.plantel.nombre),
    }));
    return { datos, total, pagina, porPagina };
  }

  async obtener(id: number, user: JwtUser, exigirTodosLosPlanteles = false) {
    const docente = await this.docentes.findOne({ where: { id } });
    if (!docente) throw new NotFoundException('Docente no encontrado');
    await this.validarAlcanceDocente(docente.usuarioId, user, exigirTodosLosPlanteles);
    return docente;
  }

  async obtenerParaApi(id: number, user: JwtUser) {
    const docente = await this.obtener(id, user);
    const permitidos = await this.scope.plantelesDe(user);
    const asignaciones = await this.asignaciones.find({ where: { usuarioId: docente.usuarioId, activo: true } });
    const clases = await this.dataSource.getRepository(GrupoMateria).find({ where: { docenteId: id,
      ...(permitidos === null ? {} : { grupo: { plantelId: In(permitidos) } }) } });
    return { ...this.proyectarDocente(docente),
      plantelIds: asignaciones.filter((a) => permitidos === null || permitidos.includes(a.plantelId)).map((a) => a.plantelId),
      clases: clases.map((c) => ({ id: c.id, grupo: c.grupo.nombre, ciclo: c.grupo.ciclo.nombre, plantel: c.grupo.plantel.nombre,
        materia: c.materia.nombre, vigente: c.grupo.activo && c.grupo.ciclo.activo })) };
  }

  async asignarPlanteles(id: number, plantelIds: number[], user: JwtUser) {
    const docente = await this.obtener(id, user, true);
    if (docente.estatus !== 'ACTIVO') throw new ConflictException('El docente no está activo');
    const ids = [...new Set(plantelIds)];
    if (!ids.length) throw new ConflictException('Asigna al menos un plantel');
    for (const plantelId of ids) await this.scope.validarGestion(user, plantelId);
    return this.dataSource.transaction(async (manager) => {
      const asignaciones = manager.getRepository(UsuarioPlantel);
      const anteriores = await asignaciones.find({ where: { usuarioId: docente.usuarioId, activo: true } });
      for (const anterior of anteriores) {
        if (ids.includes(anterior.plantelId)) continue;
        const clases = await manager.getRepository(GrupoMateria).count({ where: { docenteId: id,
          grupo: { plantelId: anterior.plantelId, activo: true, ciclo: { activo: true } } } });
        if (clases) throw new ConflictException('Reasigna las clases antes de quitar el plantel del docente');
        await asignaciones.update({ usuarioId: docente.usuarioId, plantelId: anterior.plantelId }, { activo: false });
      }
      for (const plantelId of ids) {
        if (!await manager.getRepository(Plantel).findOne({ where: { id: plantelId, activo: true } })) throw new ConflictException('El plantel no está activo');
        const actual = await asignaciones.findOne({ where: { usuarioId: docente.usuarioId, plantelId } });
        if (actual) await asignaciones.update({ usuarioId: docente.usuarioId, plantelId }, { activo: true });
        else await asignaciones.save(asignaciones.create({ usuarioId: docente.usuarioId, plantelId, activo: true }));
      }
      return { ok: true };
    });
  }

  private async validarAlcanceDocente(
    usuarioId: number, user: JwtUser, exigirTodosLosPlanteles = false,
  ): Promise<void> {
    if (user.roles.includes('SUPERADMIN')) return;
    const permitidos = await this.scope.plantelesDe(user);
    const asignaciones = await this.asignaciones.find({ where: { usuarioId, ...(exigirTodosLosPlanteles ? { activo: true } : {}) } });
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
      for (const plantelId of plantelIds) {
        if (!await manager.getRepository(Plantel).findOne({ where: { id: plantelId, activo: true } })) throw new ConflictException('El plantel no está activo');
      }
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
    if (dto.estatus !== undefined) throw new BadRequestException('Usa la acción de baja para cambiar el estado');
    return this.dataSource.transaction(async (manager) => {
      const docentes = manager.getRepository(Docente);
      const docente = await docentes.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!docente) throw new NotFoundException('Docente no encontrado');
      await this.validarAlcanceDocente(docente.usuarioId, user, true);
      if ([dto.nombre, dto.apellidoPaterno, dto.apellidoMaterno, dto.telefono].some((v) => v !== undefined)) {
        await this.usuarios.actualizar(docente.usuarioId, {
          nombre: dto.nombre,
          apellidoPaterno: dto.apellidoPaterno,
          apellidoMaterno: dto.apellidoMaterno,
          telefono: dto.telefono,
        }, manager);
      }
      Object.assign(docente, {
        cedulaProfesional: dto.cedulaProfesional === undefined ? docente.cedulaProfesional : dto.cedulaProfesional,
        especialidad: dto.especialidad === undefined ? docente.especialidad : dto.especialidad,

      });
      await docentes.save(docente);
      return this.proyectarDocente(await docentes.findOneOrFail({ where: { id } }));
    });
  }

  async baja(id: number, user: JwtUser) {
    return this.dataSource.transaction(async (manager) => {
      const docentes = manager.getRepository(Docente);
      const docente = await docentes.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!docente) throw new NotFoundException('Docente no encontrado');
      await this.validarAlcanceDocente(docente.usuarioId, user, true);
      if (docente.estatus !== 'ACTIVO') throw new ConflictException('El docente ya está dado de baja');
      docente.estatus = 'BAJA';
      await docentes.save(docente);
      // Las notas y actividades conservan a sus autores; las clases quedan pendientes de reasignación.
      await manager.getRepository(GrupoMateria).update({ docenteId: id }, { docenteId: null });
      const plantelesPrevios = await manager.getRepository(UsuarioPlantel).find({ where: { usuarioId: docente.usuarioId, activo: true } });
      await manager.getRepository(UsuarioPlantel).update(
        { usuarioId: docente.usuarioId, activo: true }, { activo: false },
      );
      await this.usuarios.actualizar(docente.usuarioId, { activo: false }, manager);
      for (const plantelId of [...new Set(plantelesPrevios.map((a) => a.plantelId))]) await manager.getRepository(BitacoraAcademica).insert({ usuarioId: user.sub, plantelId, accion: 'DOCENTE_BAJA', entidadId: id, detalle: 'Cuenta y planteles desactivados; clases pendientes de reasignación', fecha: new Date() });
      return { ok: true };
    });
  }

  async reactivar(id: number, plantelIds: number[], motivo: string, user: JwtUser) {
    const docente = await this.obtener(id, user);
    const ids = [...new Set(plantelIds)];
    for (const plantelId of ids) await this.scope.validarGestion(user, plantelId);
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Docente);
      const actual = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!actual || actual.estatus !== 'BAJA') throw new ConflictException('Solo se reactiva un docente dado de baja');
      for (const plantelId of ids) {
        if (!await manager.getRepository(Plantel).findOneBy({ id: plantelId, activo: true })) throw new ConflictException('El plantel no está activo');
      }
      await repo.update(id, { estatus: 'ACTIVO' });
      await this.usuarios.actualizar(docente.usuarioId, { activo: true }, manager);
      const asignaciones = manager.getRepository(UsuarioPlantel);
      for (const plantelId of ids) {
        const previa = await asignaciones.findOneBy({ usuarioId: actual.usuarioId, plantelId });
        if (previa) await asignaciones.update({ usuarioId: actual.usuarioId, plantelId }, { activo: true });
        else await asignaciones.insert({ usuarioId: actual.usuarioId, plantelId, activo: true });
      }
      await manager.getRepository(BitacoraAcademica).insert({ usuarioId: user.sub, plantelId: ids[0], accion: 'DOCENTE_REACTIVADO', entidadId: id, detalle: motivo, fecha: new Date() });
      return { ok: true, mensaje: 'Docente reactivado con los planteles seleccionados; reasigna sus clases explícitamente.' };
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
