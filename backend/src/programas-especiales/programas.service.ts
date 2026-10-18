import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { Alumno, BitacoraAcademica, CicloEscolar, Docente, Grupo, GrupoMateria, Inscripcion, Materia, Plantel, ProgramaEspecial, UsuarioPlantel } from '../entities';
import { JwtUser } from '../common/current-user.decorator';
import { PaginacionDto } from '../common/paginacion.dto';
import { ScopeService } from '../planteles/scope.service';
import { exigirCambios } from '../common/exigir-cambios';
import { exigirGrupoConfigurable } from '../common/contexto-academico';
import { esConflictoTransaccional, esConflictoUnico } from '../academico/conflictos';
import { validarContextoGrupo } from '../catalogos-academicos/contexto-grupo';
import { AsignaturaEspecialDto, CrearGrupoEspecialDto, CrearProgramaDto, EditarGrupoEspecialDto, EditarProgramaDto, ListarProgramasDto, TransicionEspecialDto } from './programas.dto';
@Injectable()
export class ProgramasEspecialesService {
  constructor(private readonly ds: DataSource, private readonly scope: ScopeService) {}
  async listar(q: ListarProgramasDto, user: JwtUser) {
    const planteles = await this.scope.resolverFiltro(user, q.plantelId);
    const qb = this.ds.getRepository(ProgramaEspecial).createQueryBuilder('p');
    if (planteles !== null) qb.andWhere('p.plantel_id IN (:...planteles)', { planteles });
    if (q.cicloId) qb.andWhere('p.ciclo_id = :cicloId', { cicloId: q.cicloId });
    if (q.estado) qb.andWhere('p.estado = :estado', { estado: q.estado });
    if (q.buscar?.trim()) qb.andWhere('(p.nombre LIKE :buscar OR p.clave LIKE :buscar)', { buscar: `%${q.buscar.trim()}%` });
    const [datos, total] = await qb.orderBy('p.id', 'DESC').skip((q.pagina - 1) * q.porPagina).take(q.porPagina).getManyAndCount();
    return { datos, total, pagina: q.pagina, porPagina: q.porPagina };
  }
  async obtener(id: number, user: JwtUser) {
    const programa = await this.ds.getRepository(ProgramaEspecial).findOneBy({ id });
    if (!programa) throw new NotFoundException('Programa no encontrado');
    await this.scope.validarGestion(user, programa.plantelId);
    return programa;
  }
  private async bloquear(m: EntityManager, id: number, user: JwtUser, exigirActivo = true) {
    const anterior = await m.getRepository(ProgramaEspecial).findOneBy({ id });
    if (!anterior) throw new NotFoundException('Programa no encontrado');
    await this.scope.validarGestion(user, anterior.plantelId);
    const plantel = await m.getRepository(Plantel).findOne({ where: { id: anterior.plantelId }, lock: { mode: 'pessimistic_write' } });
    const programa = await m.getRepository(ProgramaEspecial).findOneOrFail({ where: { id }, lock: { mode: 'pessimistic_write' } });
    if (exigirActivo && (!plantel?.activo || programa.estado !== 'ACTIVO')) throw new ConflictException('El programa y plantel deben estar activos');
    return programa;
  }
  private auditar(m: EntityManager, u: JwtUser, plantelId: number, accion: string, entidadId: number, detalle: string) {
    return m.getRepository(BitacoraAcademica).insert({ usuarioId: u.sub, plantelId, accion, entidadId, detalle, fecha: new Date() });
  }
  private async transaccion<T>(fn: (m: EntityManager) => Promise<T>) {
    try { return await this.ds.transaction(fn); } catch (error) {
      if (esConflictoUnico(error)) throw new ConflictException('El registro ya existe; vuelve a consultar');
      if (esConflictoTransaccional(error)) throw new ConflictException('La operación cambió concurrentemente; vuelve a consultar');
      throw error;
    }
  }
  async crear(dto: CrearProgramaDto, u: JwtUser) {
    await this.scope.validarGestion(u, dto.plantelId);
    return this.transaccion(async (m) => {
      const plantel = await m.getRepository(Plantel).findOne({ where: { id: dto.plantelId }, lock: { mode: 'pessimistic_write' } });
      const ciclo = await m.getRepository(CicloEscolar).findOneBy({ id: dto.cicloId });
      if (!plantel?.activo || !ciclo || !['ACTIVO', 'PREPARACION'].includes(ciclo.estado)) throw new ConflictException('Selecciona plantel activo y ciclo vigente o en preparación');
      if (![dto.fechaInicio, dto.fechaFin].every((f) => /^\d{4}-\d{2}-\d{2}$/.test(f)) || dto.fechaInicio > dto.fechaFin || dto.fechaInicio < ciclo.fechaInicio || dto.fechaFin > ciclo.fechaFin) throw new BadRequestException('Las fechas deben ser días válidos y estar ordenadas dentro del ciclo');
      const repo = m.getRepository(ProgramaEspecial), p = await repo.save(repo.create({ ...dto, estado: 'ACTIVO' }));
      await this.auditar(m, u, p.plantelId, 'PROGRAMA_CREADO', p.id, `tipo=${p.tipo}; cicloId=${p.cicloId}`);
      return p;
    });
  }
  async editar(id: number, dto: EditarProgramaDto, u: JwtUser) {
    exigirCambios(dto);
    return this.transaccion(async (m) => {
      const p = await this.bloquear(m, id, u, false);
      await m.getRepository(ProgramaEspecial).update(id, dto);
      await this.auditar(m, u, p.plantelId, 'PROGRAMA_EDITADO', id, 'Nombre actualizado; contexto y fechas inmutables');
      return m.getRepository(ProgramaEspecial).findOneBy({ id });
    });
  }
  async terminar(id: number, estado: 'CERRADO' | 'CANCELADO', dto: TransicionEspecialDto, u: JwtUser) {
    return this.transaccion(async (m) => {
      const p = await this.bloquear(m, id, u, false);
      if (p.estado === estado) return { ok: true }; // Reintento sin otra transición ni otro historial.
      if (p.estado !== 'ACTIVO') throw new ConflictException('El programa ya terminó; no se reabre ni se cambia su resolución');
      const grupos = await m.getRepository(Grupo).find({ where: { programaEspecialId: id }, order: { id: 'ASC' }, lock: { mode: 'pessimistic_write' } });
      const ids = grupos.map((g) => g.id);
      if (ids.length) {
        await m.getRepository(Grupo).update({ id: In(ids) }, { activo: false });
        await m.getRepository(Inscripcion).update({ grupoId: In(ids), estatus: 'ACTIVA' }, { estatus: 'BAJA' });
      }
      await m.getRepository(ProgramaEspecial).update(id, { estado });
      await this.auditar(m, u, p.plantelId, `PROGRAMA_${estado}`, id, dto.motivo);
      return { ok: true };
    });
  }
  private proyectarGrupo(g: Grupo) { return { id: g.id, nombre: g.nombre, activo: g.activo, tipo: g.tipo, cupoManual: g.cupoManual, programaEspecialId: g.programaEspecialId, turno: g.turno, plantelId: g.plantelId, cicloId: g.cicloId, nivelId: g.nivelId, carreraId: g.carreraId, periodoAcademicoId: g.periodoAcademicoId }; }
  private async asignatura(m: EntityManager, grupoId: number, p: ProgramaEspecial, dto: AsignaturaEspecialDto, claseId?: number) {
    const materia = await m.getRepository(Materia).findOneBy({ id: dto.materiaId, activo: true });
    const docente = await m.getRepository(Docente).findOne({ where: { id: dto.docenteId }, lock: { mode: 'pessimistic_write' } });
    if (!materia || !docente || docente.estatus !== 'ACTIVO' || !docente.usuario.activo) throw new ConflictException('Selecciona una materia y un docente activos');
    if (!await m.getRepository(UsuarioPlantel).existsBy({ usuarioId: docente.usuarioId, plantelId: p.plantelId, activo: true })) throw new ForbiddenException('El docente no está asignado al plantel del programa');
    const repo = m.getRepository(GrupoMateria);
    if (claseId) {
      const actual = await repo.findOneBy({ id: claseId, grupoId });
      if (!actual) throw new NotFoundException('Asignatura especial no encontrada');
      if (actual.materiaId !== dto.materiaId) throw new ConflictException('La asignatura es inmutable; selecciona la clase correcta');
      await repo.update(claseId, { docenteId: dto.docenteId });
      return { id: claseId, grupoId, materiaId: actual.materiaId, docenteId: dto.docenteId };
    }
    const gm = await repo.save(repo.create({ grupoId, materiaId: dto.materiaId, docenteId: dto.docenteId }));
    return { id: gm.id, grupoId, materiaId: gm.materiaId, docenteId: gm.docenteId };
  }
  async crearGrupo(id: number, dto: CrearGrupoEspecialDto, u: JwtUser) {
    return this.transaccion(async (m) => {
      const p = await this.bloquear(m, id, u);
      await validarContextoGrupo(m, { ...dto, plantelId: p.plantelId, cicloId: p.cicloId });
      const repo = m.getRepository(Grupo);
      const g = await repo.save(repo.create({ nombre: dto.nombre, turno: dto.turno, plantelId: p.plantelId, cicloId: p.cicloId, nivelId: dto.nivelId, carreraId: dto.carreraId, periodoAcademicoId: dto.periodoAcademicoId, tipo: 'ESPECIAL', programaEspecialId: id, cupoManual: dto.cupoManual, activo: true }));
      const clase = await this.asignatura(m, g.id, p, dto);
      await this.auditar(m, u, p.plantelId, 'GRUPO_ESPECIAL_CREADO', g.id, `programaId=${id}; cupoManual=${g.cupoManual}; grupoMateriaId=${clase.id}`);
      return { ...this.proyectarGrupo(g), clase };
    });
  }
  async grupos(id: number, q: PaginacionDto, u: JwtUser) {
    await this.obtener(id, u);
    const [filas, total] = await this.ds.getRepository(Grupo).findAndCount({ where: { programaEspecialId: id }, order: { id: 'DESC' }, skip: (q.pagina - 1) * q.porPagina, take: q.porPagina });
    return { datos: filas.map((g) => this.proyectarGrupo(g)), total, pagina: q.pagina, porPagina: q.porPagina };
  }
  private async contextoGrupo(id: number, u: JwtUser) {
    const g = await this.ds.getRepository(Grupo).findOneBy({ id });
    if (!g || g.tipo !== 'ESPECIAL' || !g.programaEspecialId) throw new NotFoundException('Grupo especial no encontrado');
    await this.scope.validarGestion(u, g.plantelId);
    return g;
  }
  async grupo(id: number, u: JwtUser) { return this.proyectarGrupo(await this.contextoGrupo(id, u)); }
  async clases(id: number, u: JwtUser) {
    await this.contextoGrupo(id, u);
    const filas = await this.ds.getRepository(GrupoMateria).find({ where: { grupoId: id }, order: { id: 'ASC' } });
    return filas.map((gm) => ({ id: gm.id, materia: { id: gm.materiaId, clave: gm.materia.clave, nombre: gm.materia.nombre }, docente: gm.docente ? { id: gm.docente.id, numEmpleado: gm.docente.numEmpleado, nombre: gm.docente.usuario.nombreCompleto } : null }));
  }
  async agregarAsignatura(id: number, dto: AsignaturaEspecialDto, u: JwtUser, claseId?: number) {
    const anterior = await this.contextoGrupo(id, u);
    return this.transaccion(async (m) => {
      const p = await this.bloquear(m, anterior.programaEspecialId!, u);
      const g = await m.getRepository(Grupo).findOneOrFail({ where: { id }, lock: { mode: 'pessimistic_write' } });
      exigirGrupoConfigurable(g);
      const clase = await this.asignatura(m, id, p, dto, claseId);
      await this.auditar(m, u, p.plantelId, claseId ? 'DOCENTE_ESPECIAL' : 'ASIGNATURA_ESPECIAL', clase.id, `grupoId=${id}`);
      return clase;
    });
  }
  async editarGrupo(id: number, dto: EditarGrupoEspecialDto, u: JwtUser) {
    exigirCambios(dto); const anterior = await this.contextoGrupo(id, u);
    return this.transaccion(async (m) => {
      const p = await this.bloquear(m, anterior.programaEspecialId!, u);
      const repo = m.getRepository(Grupo), g = await repo.findOneOrFail({ where: { id }, lock: { mode: 'pessimistic_write' } });
      const inscritos = await m.getRepository(Inscripcion).countBy({ grupoId: id, estatus: 'ACTIVA' });
      if (dto.cupoManual! < inscritos) throw new ConflictException('El cupo no puede ser menor al número de inscritos activos');
      await repo.update(id, dto);
      await this.auditar(m, u, p.plantelId, 'CUPO_ESPECIAL_EDITADO', id, `anterior=${g.cupoManual}; nuevo=${dto.cupoManual}`);
      return this.proyectarGrupo({ ...g, ...dto });
    });
  }
  async inscritos(id: number, q: PaginacionDto, u: JwtUser) {
    await this.contextoGrupo(id, u);
    const [filas, total] = await this.ds.getRepository(Inscripcion).findAndCount({ where: { grupoId: id }, order: { id: 'DESC' }, skip: (q.pagina - 1) * q.porPagina, take: q.porPagina });
    return { datos: filas.map((i) => ({ id: i.id, alumnoId: i.alumnoId, estatus: i.estatus, matricula: i.alumno.matricula, nombre: i.alumno.usuario.nombreCompleto })), total, pagina: q.pagina, porPagina: q.porPagina };
  }
  async inscribir(id: number, alumnoId: number, u: JwtUser) {
    const anterior = await this.contextoGrupo(id, u);
    return this.transaccion(async (m) => {
      const p = await this.bloquear(m, anterior.programaEspecialId!, u);
      const g = await m.getRepository(Grupo).findOneOrFail({ where: { id }, lock: { mode: 'pessimistic_write' } });
      exigirGrupoConfigurable(g);
      const alumno = await m.getRepository(Alumno).findOne({ where: { id: alumnoId }, lock: { mode: 'pessimistic_write' } });
      if (!alumno || alumno.estatus !== 'ACTIVO' || !alumno.usuario.activo) throw new ConflictException('El alumno y su cuenta deben estar activos');
      if (alumno.plantelId !== p.plantelId) throw new ForbiddenException('El alumno no pertenece al plantel del programa');
      const repo = m.getRepository(Inscripcion), previa = await repo.findOneBy({ grupoId: id, alumnoId });
      if (previa?.estatus === 'ACTIVA') throw new ConflictException('El alumno ya está inscrito en este grupo especial');
      const inscritos = await repo.countBy({ grupoId: id, estatus: 'ACTIVA' });
      if (!g.cupoManual || inscritos >= g.cupoManual) throw new ConflictException('El cupo manual del grupo está completo');
      const fila = previa ? await repo.save({ ...previa, estatus: 'ACTIVA' }) : await repo.save(repo.create({ grupoId: id, alumnoId, estatus: 'ACTIVA' }));
      await this.auditar(m, u, p.plantelId, 'INSCRIPCION_ESPECIAL', fila.id, `programaId=${p.id}; grupoId=${id}; alumnoId=${alumnoId}; reactivada=${Boolean(previa)}`);
      return { id: fila.id, grupoId: id, alumnoId, estatus: fila.estatus };
    });
  }
  async baja(id: number, inscripcionId: number, dto: TransicionEspecialDto, u: JwtUser) {
    const anterior = await this.contextoGrupo(id, u);
    return this.transaccion(async (m) => {
      const p = await this.bloquear(m, anterior.programaEspecialId!, u, false);
      await m.getRepository(Grupo).findOneOrFail({ where: { id }, lock: { mode: 'pessimistic_write' } });
      const repo = m.getRepository(Inscripcion), i = await repo.findOne({ where: { id: inscripcionId, grupoId: id }, lock: { mode: 'pessimistic_write' } });
      if (!i) throw new NotFoundException('Inscripción especial no encontrada');
      if (i.estatus === 'BAJA') return { ok: true };
      await repo.update(i.id, { estatus: 'BAJA' });
      await this.auditar(m, u, p.plantelId, 'INSCRIPCION_ESPECIAL_BAJA', i.id, dto.motivo);
      return { ok: true };
    });
  }
  async propios(q: PaginacionDto, u: JwtUser) {
    const qb = this.ds.getRepository(Inscripcion).createQueryBuilder('i').innerJoin('i.alumno', 'a').innerJoinAndSelect('i.grupo', 'g').innerJoinAndSelect('g.programaEspecial', 'p')
      .where('a.usuario_id = :usuarioId AND g.tipo = :tipo', { usuarioId: u.sub, tipo: 'ESPECIAL' });
    const [filas, total] = await qb.orderBy('i.id', 'DESC').skip((q.pagina - 1) * q.porPagina).take(q.porPagina).getManyAndCount();
    return { datos: filas.map((i) => ({ inscripcionId: i.id, estatus: i.estatus, grupo: { id: i.grupoId, nombre: i.grupo.nombre }, programa: { id: i.grupo.programaEspecialId, nombre: i.grupo.programaEspecial!.nombre, tipo: i.grupo.programaEspecial!.tipo, estado: i.grupo.programaEspecial!.estado } })), total, pagina: q.pagina, porPagina: q.porPagina };
  }
}
