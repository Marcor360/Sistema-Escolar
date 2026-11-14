import { esConflictoTransaccional, esConflictoUnico } from '../academico/conflictos';
import { Rol } from '../entities/rol.entity';
import { HistorialRolesUsuario } from '../entities/historial-roles-usuario.entity';
import { validarCambioRolesPersonal } from '../common/jerarquia-roles';
import { RolClave } from '../common/roles.decorator';
import { EntityManager } from 'typeorm';
import { vincularPersonalDocente } from './vincular-personal';
import { randomBytes } from 'crypto';
import { Usuario } from '../entities/usuario.entity';
import { BitacoraAcademica } from '../entities/bitacora-academica.entity';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Plantel } from '../entities/plantel.entity';
import { GrupoMateria } from '../entities/grupo-materia.entity';
import { Docente } from '../entities/docente.entity';
import { UsuariosService } from '../usuarios/usuarios.service';
import { ActualizarDocenteDto, CrearDocenteDto, ListarDocentesDto, VincularPersonalDocenteDto } from './docentes.dto';
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
    const porPagina = query.porPagina || 10;
    const planteles = await this.scope.resolverFiltro(user, query.plantelId);
    const qb = this.docentes.createQueryBuilder('d').innerJoinAndSelect('d.usuario', 'u');
    if (planteles !== null) qb.andWhere(
      'EXISTS (SELECT 1 FROM usuario_planteles up WHERE up.usuario_id = u.id AND (up.activo = :activa OR d.estatus = :baja) AND up.plantel_id IN (:...planteles))',
      { activa: true, baja: 'BAJA', planteles },
    );
    if (query.buscar?.trim()) qb.andWhere('(d.num_empleado LIKE :buscar OR u.nombre LIKE :buscar OR u.segundo_nombre LIKE :buscar OR u.apellido_paterno LIKE :buscar OR u.apellido_materno LIKE :buscar)', { buscar: `%${query.buscar.trim()}%` });
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
      ...(permitidos === null ? {} : { grupo: { plantelId: In(permitidos) } }) }, relations: { grupo: { nivel: true, carrera: true, periodoAcademico: true } } });
    return { ...this.proyectarDocente(docente),
      plantelIds: asignaciones.filter((a) => permitidos === null || permitidos.includes(a.plantelId)).map((a) => a.plantelId),
      clases: clases.map((c) => ({ id: c.id, grupo: c.grupo.nombre, ciclo: c.grupo.ciclo.nombre, plantel: c.grupo.plantel.nombre,
        nivel: c.grupo.nivel?.nombre ?? null, carrera: c.grupo.carrera?.nombre ?? null, versionPlan: c.grupo.carrera?.versionPlan ?? null, periodo: c.grupo.periodoAcademico?.nombre ?? null, turno: c.grupo.turno, materia: c.materia.nombre, vigente: c.grupo.activo && c.grupo.ciclo.activo })) };
  }

  async asignarPlanteles(id: number, plantelIds: number[], user: JwtUser) {
    const docente = await this.obtener(id, user, true);
    if (docente.estatus !== 'ACTIVO') throw new ConflictException('El docente no está activo');
    const ids = [...new Set(plantelIds)];
    if (!ids.length) throw new ConflictException('Asigna al menos un plantel');
    for (const plantelId of ids) await this.scope.validarGestion(user, plantelId);
    return this.dataSource.transaction(async (manager) => {
      await this.validarPersonalCompartido(manager, docente, user);
      if (this.esPersonalCompartido(docente)) throw new ConflictException('Gestiona los planteles del personal con varias funciones desde Usuarios');
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

  private esPersonalCompartido(docente: Docente) {
    return docente.usuario?.roles?.some(r => ['ADMINISTRATIVO', 'FINANZAS', 'DIRECTOR', 'SUPERADMIN'].includes(r.clave)) ?? false;
  }

  private async validarPersonalCompartido(manager: EntityManager, docente: Docente, user: JwtUser) {
    docente.usuario = await manager.getRepository(Usuario).findOneOrFail({ where: { id: docente.usuarioId }, lock: { mode: 'pessimistic_write' } });
    if (!this.esPersonalCompartido(docente)) return;
    const actor = await manager.getRepository(Usuario).findOneBy({ id: user.sub, activo: true });
    if (!actor) throw new ForbiddenException('Cuenta autorizante inactiva');
    const roles = docente.usuario.roles.map(r => r.clave) as RolClave[];
    validarCambioRolesPersonal({ sub: actor.id, roles: actor.roles.map(r => r.clave) }, docente.usuarioId, roles, roles);
  }

  private async cambiarFuncionCompartida(manager: EntityManager, docente: Docente, activar: boolean, actor: JwtUser) {
    const usuario = await manager.getRepository(Usuario).findOneOrFail({ where: { id: docente.usuarioId }, lock: { mode: 'pessimistic_write' } });
    const anteriores = usuario.roles.map(r => r.clave);
    usuario.roles = usuario.roles.filter(r => r.clave !== 'MAESTRO');
    if (activar) usuario.roles.push(await manager.getRepository(Rol).findOneByOrFail({ clave: 'MAESTRO' }));
    usuario.sessionVersion = (usuario.sessionVersion ?? 0) + 1;
    await manager.getRepository(Usuario).save(usuario);
    await manager.getRepository(HistorialRolesUsuario).insert({ usuarioId: usuario.id, actorId: actor.sub, rolesAntes: anteriores.sort().join(','), rolesDespues: usuario.roles.map(r => r.clave).sort().join(',') });
  }

  async obtenerPorUsuario(usuarioId: number) {
    const docente = await this.docentes.findOne({ where: { usuarioId } });
    if (!docente) throw new NotFoundException('El usuario no tiene expediente de docente');
    return docente;
  }

  async vincularPersonal(dto: VincularPersonalDocenteDto, user: JwtUser) {
    try { return await this.dataSource.transaction(m => vincularPersonalDocente(m, dto, user, this.scope)); }
    catch (e) {
      if (esConflictoUnico(e) || esConflictoTransaccional(e)) throw new ConflictException('La cuenta o el expediente cambiaron concurrentemente; consulta el resultado antes de reintentar');
      throw e;
    }
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
        password: randomBytes(32).toString('base64url'),
        nombre: dto.nombre,
        segundoNombre: dto.segundoNombre,
        apellidoPaterno: dto.apellidoPaterno,
        apellidoMaterno: dto.apellidoMaterno,
        telefono: dto.telefono,
        roles: ['MAESTRO'],
        correoProveedor: dto.correoProveedor,
      }, manager);
      await manager.getRepository(Usuario).update({ id: usuario.id }, { activacionPendiente: true });
      const docentes = manager.getRepository(Docente);
      const docente = await docentes.save(docentes.create({
        usuarioId: usuario.id,
        numEmpleado: dto.numEmpleado,
        cedulaProfesional: dto.cedulaPendiente ? null : dto.cedulaProfesional,
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
      await this.validarPersonalCompartido(manager, docente, user);
      if ([dto.nombre, dto.segundoNombre, dto.apellidoPaterno, dto.apellidoMaterno, dto.telefono, dto.correoProveedor].some((v) => v !== undefined)) {
        await this.usuarios.actualizar(docente.usuarioId, {
          nombre: dto.nombre,
          segundoNombre: dto.segundoNombre,
          apellidoPaterno: dto.apellidoPaterno,
          apellidoMaterno: dto.apellidoMaterno,
          telefono: dto.telefono,
          correoProveedor: dto.correoProveedor,
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
      await this.validarPersonalCompartido(manager, docente, user);
      if (docente.estatus !== 'ACTIVO') throw new ConflictException('El docente ya está dado de baja');
      docente.estatus = 'BAJA';
      await docentes.save(docente);
      // Las notas y actividades conservan a sus autores; las clases quedan pendientes de reasignación.
      await manager.getRepository(GrupoMateria).update({ docenteId: id }, { docenteId: null });
      const plantelesPrevios = await manager.getRepository(UsuarioPlantel).find({ where: { usuarioId: docente.usuarioId, activo: true } });
      if (this.esPersonalCompartido(docente)) await this.cambiarFuncionCompartida(manager, docente, false, user);
      else {
        await manager.getRepository(UsuarioPlantel).update({ usuarioId: docente.usuarioId, activo: true }, { activo: false });
        await this.usuarios.actualizar(docente.usuarioId, { activo: false }, manager);
      }
      for (const plantelId of [...new Set(plantelesPrevios.map((a) => a.plantelId))]) await manager.getRepository(BitacoraAcademica).insert({ usuarioId: user.sub, plantelId, accion: 'DOCENTE_BAJA', entidadId: id, detalle: this.esPersonalCompartido(docente) ? 'Baja de función docente; conserva cuenta, funciones administrativas y planteles; clases pendientes' : 'Cuenta y planteles desactivados; clases pendientes de reasignación', fecha: new Date() });
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
      await this.validarPersonalCompartido(manager, actual, user);
      if (this.esPersonalCompartido(actual)) {
        if (!actual.usuario.activo) throw new ConflictException('Reactiva primero la cuenta de personal desde Usuarios');
        const vigentes = await manager.getRepository(UsuarioPlantel).find({ where: { usuarioId: actual.usuarioId, activo: true } });
        if (ids.length !== vigentes.length || ids.some(id => !vigentes.some(p => p.plantelId === id))) throw new ConflictException('El personal compartido conserva sus planteles; gestiona sus asignaciones desde Usuarios');
        await this.cambiarFuncionCompartida(manager, actual, true, user);
      } else await this.usuarios.actualizar(docente.usuarioId, { activo: true }, manager);
      await repo.update(id, { estatus: 'ACTIVO' });
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
          correoProveedor: docente.usuario.correoProveedor,
          nombre: docente.usuario.nombre,
          segundoNombre: docente.usuario.segundoNombre ?? null,
          apellidoPaterno: docente.usuario.apellidoPaterno,
          apellidoMaterno: docente.usuario.apellidoMaterno,
          telefono: docente.usuario.telefono,
        },
      } : {}),
      ...extra,
    };
  }
}
