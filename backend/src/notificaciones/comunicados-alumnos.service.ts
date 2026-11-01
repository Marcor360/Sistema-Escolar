import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { JwtUser } from '../common/current-user.decorator';
import { PaginacionDto } from '../common/paginacion.dto';
import { Alumno } from '../entities/alumno.entity';
import { ComunicadoAlumno } from '../entities/comunicado-alumno.entity';
import { Notificacion } from '../entities/notificacion.entity';
import { Usuario } from '../entities/usuario.entity';
import { ScopeService } from '../planteles/scope.service';
import { CrearComunicadoDto, EditarComunicadoDto } from './comunicados-alumnos.dto';

const MAX_DESTINATARIOS = 500;

@Injectable()
export class ComunicadosAlumnosService {
  constructor(private readonly ds: DataSource, private readonly scope: ScopeService) {}

  private validarPortal(actor: JwtUser): void {
    if (actor.portal === 'MOVIL' || !actor.roles.some((rol) => ['ADMINISTRATIVO', 'SUPERADMIN'].includes(rol))) {
      throw new ForbiddenException('Los comunicados se administran únicamente desde la plataforma web');
    }
  }

  async crear(dto: CrearComunicadoDto, actor: JwtUser) {
    this.validarPortal(actor);
    await this.scope.validarGestion(actor, dto.plantelId);
    const repo = this.ds.getRepository(ComunicadoAlumno);
    const registro = await repo.save(repo.create({
      plantelId: dto.plantelId, titulo: dto.titulo.trim(), mensaje: dto.mensaje.trim(),
      creadoPorId: actor.sub, estado: 'BORRADOR', destinatarios: 0, enviadoEn: null,
    }));
    return registro;
  }

  async listar(query: PaginacionDto, actor: JwtUser) {
    this.validarPortal(actor);
    const ids = await this.scope.plantelesDe(actor);
    if (ids !== null && ids.length === 0) return { datos: [], total: 0, pagina: query.pagina, porPagina: query.porPagina };
    const [datos, total] = await this.ds.getRepository(ComunicadoAlumno).findAndCount({
      where: ids === null ? {} : { plantelId: In(ids) },
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: (query.pagina - 1) * query.porPagina,
      take: Math.min(query.porPagina, 50),
    });
    return { datos, total, pagina: query.pagina, porPagina: Math.min(query.porPagina, 50) };
  }

  async editar(id: number, dto: EditarComunicadoDto, actor: JwtUser) {
    this.validarPortal(actor);
    const registro = await this.exigirAcceso(id, actor);
    return this.ds.transaction(async (manager) => {
      const repo = manager.getRepository(ComunicadoAlumno);
      const actual = await repo.findOne({ where: { id: registro.id }, lock: { mode: 'pessimistic_write' } });
      if (!actual) throw new NotFoundException('Comunicado no encontrado');
      if (actual.estado !== 'BORRADOR') throw new ConflictException('Un comunicado enviado no se puede editar');
      actual.titulo = dto.titulo.trim();
      actual.mensaje = dto.mensaje.trim();
      return repo.save(actual);
    });
  }

  async vistaPrevia(id: number, actor: JwtUser) {
    this.validarPortal(actor);
    const registro = await this.exigirAcceso(id, actor);
    const ids = await this.destinatarios(registro.plantelId, this.ds);
    return { plantelId: registro.plantelId, destinatarios: ids.length, excedeLimite: ids.length > MAX_DESTINATARIOS };
  }

  async publicar(id: number, actor: JwtUser) {
    this.validarPortal(actor);
    const registro = await this.exigirAcceso(id, actor);
    return this.ds.transaction(async (manager) => {
      const repo = manager.getRepository(ComunicadoAlumno);
      const actual = await repo.findOne({ where: { id: registro.id }, lock: { mode: 'pessimistic_write' } });
      if (!actual) throw new NotFoundException('Comunicado no encontrado');
      if (actual.estado === 'ENVIADO') return { id: actual.id, enviadas: actual.destinatarios, repetido: true };
      const ids = await this.destinatarios(actual.plantelId, manager);
      if (ids.length === 0) throw new ConflictException('No hay alumnos activos destinatarios en este plantel');
      if (ids.length > MAX_DESTINATARIOS) throw new ConflictException('El plantel supera 500 alumnos. Divide la campaña antes de enviar');
      const avisos = manager.getRepository(Notificacion);
      for (let inicio = 0; inicio < ids.length; inicio += 100) {
        await avisos.insert(ids.slice(inicio, inicio + 100).map((usuarioId) => ({
          usuarioId, titulo: actual.titulo, mensaje: actual.mensaje,
          tipo: 'GENERAL' as const, leida: false, pushPendiente: true,
        })));
      }
      actual.estado = 'ENVIADO';
      actual.destinatarios = ids.length;
      actual.enviadoEn = new Date();
      await repo.save(actual);
      // El worker PushService recupera pushPendiente después del COMMIT.
      return { id: actual.id, enviadas: ids.length, repetido: false };
    });
  }

  private async exigirAcceso(id: number, actor: JwtUser) {
    const registro = await this.ds.getRepository(ComunicadoAlumno).findOneBy({ id });
    if (!registro) throw new NotFoundException('Comunicado no encontrado');
    await this.scope.validarGestion(actor, registro.plantelId);
    return registro;
  }

  private async destinatarios(plantelId: number, fuente: DataSource | import('typeorm').EntityManager): Promise<number[]> {
    const filas = await fuente.getRepository(Alumno).createQueryBuilder('al')
      .innerJoin(Usuario, 'u', 'u.id = al.usuarioId AND u.activo = :activo', { activo: true })
      .innerJoin('u.roles', 'rol', 'rol.clave = :rol', { rol: 'ALUMNO' })
      .select('DISTINCT al.usuarioId', 'id')
      .where('al.plantelId = :plantelId', { plantelId })
      .andWhere('al.estatus = :estatus', { estatus: 'ACTIVO' })
      .limit(MAX_DESTINATARIOS + 1).getRawMany<{ id: number }>();
    return filas.map((fila) => Number(fila.id));
  }
}
