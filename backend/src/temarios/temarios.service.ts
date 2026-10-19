import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { unlink } from 'fs/promises';
import { resolve } from 'path';
import { Tema, TemaAdjunto, TemaRevision } from '../entities/tema.entity';
import { GrupoMateria } from '../entities/grupo-materia.entity';
import { Inscripcion } from '../entities/inscripcion.entity';
import { BitacoraAcademica } from '../entities/bitacora-academica.entity';
import { JwtUser } from '../common/current-user.decorator';
import { ScopeService } from '../planteles/scope.service';
import { exigirGrupoVigente, inscripcionVigente } from '../common/contexto-academico';
import { recursaClase } from '../recursamientos/acceso-recursamiento';
import { validarContenidoArchivo } from '../common/validar-archivo';
import { uploadsPath } from '../common/uploads-path';
import { programarLimpieza } from '../archivos/archivo-limpieza.service';
import { CancelarTemaDto, ConsultarTemasDto, CrearTemaDto, EditarTemaDto } from './temarios.dto';

@Injectable()
export class TemariosService {
  constructor(private readonly ds: DataSource, private readonly scope: ScopeService) {}
  private gestor(user: JwtUser, gm: GrupoMateria) { return user.roles.some(r => ['SUPERADMIN', 'ADMINISTRATIVO'].includes(r)) || (user.roles.includes('MAESTRO') && gm.docente?.usuarioId === user.sub); }
  async autorizarClase(id: number, user: JwtUser, escritura = false, manager = this.ds.manager) {
    const gm = await manager.getRepository(GrupoMateria).findOneBy({ id });
    if (!gm) throw new NotFoundException('Clase no encontrada');
    if (user.roles.includes('SUPERADMIN')) { if (escritura) exigirGrupoVigente(gm.grupo); return gm; }
    if (user.roles.includes('ADMINISTRATIVO')) { await this.scope.validarGestion(user, gm.grupo.plantelId); if (escritura) exigirGrupoVigente(gm.grupo); return gm; }
    if (user.roles.includes('MAESTRO') && gm.docente?.usuarioId === user.sub) { if (escritura) exigirGrupoVigente(gm.grupo); return gm; }
    if (!escritura && user.roles.includes('ALUMNO')) {
      exigirGrupoVigente(gm.grupo);
      const inscrito = await manager.getRepository(Inscripcion).exists({ where: { ...inscripcionVigente, alumno: { ...inscripcionVigente.alumno, usuarioId: user.sub }, grupoId: gm.grupoId } });
      if (inscrito || await recursaClase(manager, user.sub, gm.id)) return gm;
    }
    throw new ForbiddenException('No tienes acceso a este temario');
  }
  private visible(tema: Tema) { const ahora = new Date(); return tema.estado === 'PUBLICADO' && (!tema.desde || tema.desde <= ahora) && (!tema.hasta || tema.hasta >= ahora); }
  async obtener(id: number, user: JwtUser) {
    const tema = await this.ds.getRepository(Tema).findOneBy({ id });
    if (!tema) throw new NotFoundException('Tema no encontrado');
    const gm = await this.autorizarClase(tema.grupoMateriaId, user);
    if (!this.gestor(user, gm) && !this.visible(tema)) throw new NotFoundException('Tema no disponible');
    return this.proyectar(tema);
  }
  async listar(claseId: number, q: ConsultarTemasDto, user: JwtUser) {
    const gm = await this.autorizarClase(claseId, user);
    const qb = this.ds.getRepository(Tema).createQueryBuilder('t').where('t.grupoMateriaId = :claseId', { claseId });
    if (!this.gestor(user, gm)) qb.andWhere('t.estado = :estado', { estado: 'PUBLICADO' }).andWhere('(t.desde IS NULL OR t.desde <= :ahora)', { ahora: new Date() }).andWhere('(t.hasta IS NULL OR t.hasta >= :ahora)');
    if (q.buscar?.trim()) qb.andWhere("t.titulo LIKE :buscar ESCAPE '!'", { buscar: '%' + q.buscar.trim().replace(/[!%_[]/g, '!$&') + '%' });
    const [temas, total] = await qb.orderBy('t.indice', 'ASC').addOrderBy('t.id', 'ASC').skip((q.pagina - 1) * q.porPagina).take(q.porPagina).getManyAndCount();
    return { datos: await Promise.all(temas.map(t => this.proyectar(t))), total, pagina: q.pagina, porPagina: q.porPagina };
  }
  private async proyectar(t: Tema) {
    const adjuntos = await this.ds.getRepository(TemaAdjunto).find({ where: { temaId: t.id, activo: true }, order: { id: 'ASC' }, select: { id: true, archivoNombre: true, tamanoKb: true } });
    return { id: t.id, grupoMateriaId: t.grupoMateriaId, indice: t.indice, titulo: t.titulo, contenido: t.contenido, estado: t.estado, desde: t.desde, hasta: t.hasta, parcial: t.parcial, enlace: t.enlace, revision: t.revision, adjuntos };
  }
  private validar(t: Tema) {
    if (!t.titulo?.trim() || !t.contenido?.trim() || !Number.isInteger(t.indice) || t.indice < 1) throw new BadRequestException('Indica orden, título y contenido');
    if (!['BORRADOR', 'PUBLICADO', 'CANCELADO'].includes(t.estado)) throw new BadRequestException('Estado de tema inválido');
    if (t.desde && t.hasta && t.hasta < t.desde) throw new BadRequestException('La fecha límite debe ser posterior a la publicación');
    if (t.enlace && new URL(t.enlace).protocol !== 'https:') throw new BadRequestException('Solo se admiten enlaces HTTPS');
  }
  private aplicar(t: Tema, dto: Partial<CrearTemaDto>) {
    for (const k of ['indice', 'titulo', 'contenido', 'estado', 'parcial', 'enlace'] as const) if (dto[k] !== undefined) Object.assign(t, { [k]: dto[k] });
    if (dto.desde !== undefined) t.desde = dto.desde ? new Date(dto.desde) : null;
    if (dto.hasta !== undefined) t.hasta = dto.hasta ? new Date(dto.hasta) : null;
    this.validar(t);
  }
  private async registrar(m: EntityManager, t: Tema, user: JwtUser, accion: string, detalle = '') {
    const gm = await m.getRepository(GrupoMateria).findOneByOrFail({ id: t.grupoMateriaId });
    const adjuntos = await m.getRepository(TemaAdjunto).find({ where: { temaId: t.id, activo: true }, select: { id: true, archivoNombre: true }, order: { id: 'ASC' } });
    await m.getRepository(TemaRevision).insert({ temaId: t.id, revision: t.revision, usuarioId: user.sub, accion, detalle: JSON.stringify({ indice: t.indice, titulo: t.titulo, contenido: t.contenido, estado: t.estado, desde: t.desde, hasta: t.hasta, parcial: t.parcial, enlace: t.enlace, adjuntos, motivo: detalle }) });
    await m.getRepository(BitacoraAcademica).insert({ usuarioId: user.sub, plantelId: gm.grupo.plantelId, accion, entidadId: t.id, detalle: JSON.stringify({ claseId: t.grupoMateriaId, revision: t.revision, estado: t.estado, motivo: detalle }), fecha: new Date() });
  }
  private async bloqueado(m: EntityManager, id: number, revision: number, user: JwtUser) {
    const t = await m.getRepository(Tema).findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
    if (!t) throw new NotFoundException('Tema no encontrado');
    await this.autorizarClase(t.grupoMateriaId, user, true, m);
    if (t.estado === 'CANCELADO') throw new ConflictException('El tema fue cancelado; conserva su historial');
    if (t.revision !== revision) throw new ConflictException('El tema cambió; vuelve a consultarlo antes de guardar');
    return t;
  }
  private conflicto(error: unknown): never {
    const code = (error as { driverError?: { code?: string; number?: number } }).driverError;
    if (code?.code === 'ER_DUP_ENTRY' || [2601, 2627].includes(code?.number ?? 0)) throw new ConflictException('El orden ya está ocupado en esta clase, incluso por un tema cancelado');
    throw error;
  }
  async crear(dto: CrearTemaDto, user: JwtUser) {
    await this.autorizarClase(dto.grupoMateriaId, user, true);
    let id: number;
    try { id = await this.ds.transaction(async m => {
      await this.autorizarClase(dto.grupoMateriaId, user, true, m);
      const t = m.getRepository(Tema).create({ grupoMateriaId: dto.grupoMateriaId, creadorId: user.sub, revision: 1, estado: 'BORRADOR', desde: null, hasta: null, parcial: null, enlace: null });
      this.aplicar(t, dto); await m.save(t); await this.registrar(m, t, user, 'TEMA_CREADO'); return t.id;
    }); } catch (e) { return this.conflicto(e); }
    return this.obtener(id, user);
  }
  async editar(id: number, dto: EditarTemaDto, user: JwtUser) {
    try { await this.ds.transaction(async m => { const t = await this.bloqueado(m, id, dto.revision, user); this.aplicar(t, dto); t.revision++; await m.save(t); await this.registrar(m, t, user, 'TEMA_EDITADO'); }); } catch (e) { return this.conflicto(e); }
    return this.obtener(id, user);
  }
  async cancelar(id: number, dto: CancelarTemaDto, user: JwtUser) {
    if (!dto.motivo.trim()) throw new BadRequestException('Indica el motivo de cancelación');
    await this.ds.transaction(async m => { const t = await this.bloqueado(m, id, dto.revision, user); t.estado = 'CANCELADO'; t.revision++; await m.save(t); await this.registrar(m, t, user, 'TEMA_CANCELADO', dto.motivo.trim()); });
    return this.obtener(id, user);
  }
  async adjuntar(id: number, revision: number, archivo: Express.Multer.File | undefined, user: JwtUser) {
    let persistido = false;
    try {
      if (!archivo) throw new BadRequestException('Selecciona un archivo');
      await validarContenidoArchivo(archivo);
      await this.ds.transaction(async m => {
        const t = await this.bloqueado(m, id, revision, user);
        if (await m.getRepository(TemaAdjunto).countBy({ temaId: id, activo: true }) >= 20) throw new ConflictException('Máximo veinte adjuntos por tema');
        await m.getRepository(TemaAdjunto).save({ temaId: id, archivoNombre: archivo.originalname, archivoRuta: '/uploads/' + archivo.filename, mime: archivo.mimetype, tamanoKb: Math.ceil(archivo.size / 1024), activo: true });
        t.revision++; await m.save(t); await this.registrar(m, t, user, 'TEMA_ADJUNTO');
      });
      persistido = true;
      return this.obtener(id, user);
    } catch (e) { if (!persistido && archivo?.path && resolve(archivo.path) === resolve(uploadsPath(), archivo.filename)) await unlink(archivo.path).catch(() => undefined); throw e; }
  }
  async retirar(id: number, adjuntoId: number, revision: number, user: JwtUser) {
    await this.ds.transaction(async m => {
      const t = await this.bloqueado(m, id, revision, user);
      const a = await m.getRepository(TemaAdjunto).findOneBy({ id: adjuntoId, temaId: id, activo: true });
      if (!a) throw new NotFoundException('Adjunto no encontrado');
      a.activo = false; await m.save(a); await programarLimpieza(m, a.archivoRuta);
      t.revision++; await m.save(t); await this.registrar(m, t, user, 'TEMA_ADJUNTO_RETIRADO');
    });
    return this.obtener(id, user);
  }
  async historial(id: number, q: ConsultarTemasDto, user: JwtUser) {
    const t = await this.ds.getRepository(Tema).findOneBy({ id });
    if (!t) throw new NotFoundException('Tema no encontrado');
    const gm = await this.autorizarClase(t.grupoMateriaId, user);
    if (!this.gestor(user, gm)) throw new ForbiddenException('Historial reservado a responsables de la clase');
    const [datos, total] = await this.ds.getRepository(TemaRevision).createQueryBuilder('b').where('b.temaId = :id', { id }).orderBy('b.id', 'DESC').skip((q.pagina - 1) * q.porPagina).take(q.porPagina).getManyAndCount();
    return { datos, total, pagina: q.pagina, porPagina: q.porPagina };
  }
  async archivo(id: number, user: JwtUser) {
    const a = await this.ds.getRepository(TemaAdjunto).findOneBy({ id, activo: true });
    if (!a) throw new NotFoundException('Adjunto no encontrado');
    await this.obtener(a.temaId, user);
    return a;
  }
}
