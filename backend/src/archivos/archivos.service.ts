import { CalendarioService } from '../calendario/calendario.service';
import { TemariosService } from '../temarios/temarios.service';
import { recursaClase } from '../recursamientos/acceso-recursamiento';
import { BibliotecaArchivo } from '../entities/biblioteca.entity';
import { contentDisposition } from '../common/content-disposition';
import { ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createReadStream, existsSync } from 'fs';
import { basename, extname, join } from 'path';
import { uploadsPath } from '../common/uploads-path';
import type { Response } from 'express';
import { Material } from '../entities/material.entity';
import { Entrega } from '../entities/entrega.entity';
import { Inscripcion } from '../entities/inscripcion.entity';
import { Usuario } from '../entities/usuario.entity';
import { sesionInactiva } from '../auth/sesion-inactividad';
import { Sesion } from '../entities/sesion.entity';
import { grupoVigente } from '../common/contexto-academico';
import { ScopeService } from '../planteles/scope.service';
import { JwtUser } from '../common/current-user.decorator';

type RecursoArchivo = 'temario' | 'material' | 'entrega' | 'biblioteca' | 'boleta' | 'calendario';

interface EnlacePayload {
  sub: number;
  rec: RecursoArchivo;
  id: number;
  sid: string;
  ver: number;
  kind: 'FILE';
  cicloId?: number;
  inscripcionId?: number;
  formatoBoleta?: 'informativa-pdf' | 'informativa-excel' | 'constancia-aceptacion';
  respuestaId?: number;
}

/** Deducción de Content-Type para entregas (los materiales ya guardan su `mime`). */
const MIME_POR_EXTENSION: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.zip': 'application/zip',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.md': 'text/plain',
  '.rtf': 'application/rtf',
  '.odt': 'application/vnd.oasis.opendocument.text',
  '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
  '.odp': 'application/vnd.oasis.opendocument.presentation',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.m4a': 'audio/mp4',
};

/**
 * Descarga autorizada de `uploads/`: los enlaces `<a>`/`Linking.openURL` no envían el
 * encabezado Authorization, así que la autorización viaja en un JWT de 5 minutos (`t`)
 * que se vuelve a validar contra la pertenencia real del recurso en cada streaming.
 */
@Injectable()
export class ArchivosService {
  constructor(
    @InjectRepository(Material) private readonly materiales: Repository<Material>,
    @InjectRepository(Entrega) private readonly entregas: Repository<Entrega>,
    @InjectRepository(Inscripcion) private readonly inscripciones: Repository<Inscripcion>,
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    private readonly scope: ScopeService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly temarios: TemariosService,
    private readonly calendario: CalendarioService,
  ) {}

  async enlaceCalendario(id: number, user: JwtUser) {
    await this.calendario.imagen(id, user);
    return {
      url: '/api/archivos/calendario/' + id + '?t=' + this.firmar({ sub: user.sub, rec: 'calendario', id }, user),
    };
  }
  async descargarCalendario(id: number, token: string, res: Response) {
    const payload = this.verificarToken(token, 'calendario', id);
    const imagen = await this.calendario.imagen(id, await this.usuarioDesdeToken(payload));
    res.setHeader('Content-Type', imagen.tipo);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(imagen.archivo);
  }

  async enlaceTemario(id: number, user: JwtUser) {
    await this.temarios.archivo(id, user);
    return { url: '/api/archivos/temarios/' + id + '?t=' + this.firmar({ sub: user.sub, rec: 'temario', id }, user) };
  }
  async descargarTemario(id: number, token: string, res: Response) {
    const payload = this.verificarToken(token, 'temario', id);
    const a = await this.temarios.archivo(id, await this.usuarioDesdeToken(payload));
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    this.enviarArchivo(res, a.archivoRuta, a.archivoNombre, undefined, 'attachment');
  }

  // ---- Materiales ----
  async enlaceMaterial(id: number, user: JwtUser) {
    const material = await this.obtenerMaterial(id);
    await this.validarAccesoMaterial(material, user);
    return { url: `/api/archivos/materiales/${id}?t=${this.firmar({ sub: user.sub, rec: 'material', id }, user)}` };
  }

  async descargarMaterial(id: number, token: string, res: Response) {
    const payload = this.verificarToken(token, 'material', id);
    const material = await this.obtenerMaterial(id);
    const user = await this.usuarioDesdeToken(payload);
    await this.validarAccesoMaterial(material, user);
    this.enviarArchivo(res, material.archivoRuta, material.archivoNombre, material.mime ?? undefined);
  }

  // ---- Entregas ----
  async enlaceEntrega(id: number, user: JwtUser) {
    const entrega = await this.obtenerEntrega(id);
    await this.validarAccesoEntrega(entrega, user);
    return { url: `/api/archivos/entregas/${id}?t=${this.firmar({ sub: user.sub, rec: 'entrega', id }, user)}` };
  }

  async descargarEntrega(id: number, token: string, res: Response) {
    const payload = this.verificarToken(token, 'entrega', id);
    const entrega = await this.obtenerEntrega(id);
    const user = await this.usuarioDesdeToken(payload);
    await this.validarAccesoEntrega(entrega, user);
    const mime = MIME_POR_EXTENSION[extname(entrega.archivoNombre ?? '').toLowerCase()] ?? 'application/octet-stream';
    this.enviarArchivo(res, entrega.archivoRuta as string, entrega.archivoNombre as string, mime);
  }

  async enlaceBiblioteca(id: number, user: JwtUser) {
    if (!user.roles.some((r) => ['SUPERADMIN', 'ADMINISTRATIVO'].includes(r)))
      throw new ForbiddenException('La biblioteca corresponde al personal administrativo');
    const archivo = await this.usuarios.manager.getRepository(BibliotecaArchivo).findOneBy({ id });
    if (!archivo) throw new NotFoundException('Archivo no encontrado');
    await this.scope.validarGestion(user, archivo.plantelId);
    return { url: `/api/archivos/biblioteca/${id}?t=${this.firmar({ sub: user.sub, rec: 'biblioteca', id }, user)}` };
  }
  async descargarBiblioteca(id: number, token: string, res: Response) {
    const payload = this.verificarToken(token, 'biblioteca', id),
      user = await this.usuarioDesdeToken(payload);
    if (!user.roles.some((r) => ['SUPERADMIN', 'ADMINISTRATIVO'].includes(r)))
      throw new ForbiddenException('La biblioteca corresponde al personal administrativo');
    const archivo = await this.usuarios.manager.getRepository(BibliotecaArchivo).findOneBy({ id });
    if (!archivo) throw new NotFoundException('Archivo no encontrado');
    await this.scope.validarGestion(user, archivo.plantelId);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    this.enviarArchivo(res, archivo.archivoRuta, archivo.archivoNombre, archivo.mime, 'attachment');
  }

  enlaceBoleta(
    alumnoId: number,
    cicloId: number | undefined,
    inscripcionId: number | undefined,
    user: JwtUser,
    formatoBoleta?: 'informativa-pdf' | 'informativa-excel' | 'constancia-aceptacion',
    respuestaId?: number,
  ) {
    if (!user.sid || !Number.isInteger(user.ver)) throw new UnauthorizedException('Sesión no válida');
    const token = this.jwt.sign(
      {
        sub: user.sub,
        rec: 'boleta',
        id: alumnoId,
        cicloId,
        inscripcionId,
        formatoBoleta,
        respuestaId,
        sid: user.sid,
        ver: user.ver,
        kind: 'FILE',
      },
      { expiresIn: '2m' },
    );
    return { url: `/api/reportes/boleta-descarga/${alumnoId}?t=${token}`, expiraEn: 120 };
  }
  async usuarioBoleta(alumnoId: number, token: string) {
    const payload = this.verificarToken(token, 'boleta', alumnoId);
    const user = await this.usuarioDesdeToken(payload);
    if (!user.roles.includes('ALUMNO')) throw new ForbiddenException('Boleta reservada al alumno');
    return {
      user,
      cicloId: payload.cicloId,
      inscripcionId: payload.inscripcionId,
      formatoBoleta: payload.formatoBoleta,
      respuestaId: payload.respuestaId,
    };
  }

  // ---- Carga y validación ----
  private async obtenerMaterial(id: number): Promise<Material> {
    const material = await this.materiales.findOne({
      where: { id },
      relations: { grupoMateria: { grupo: true, docente: true } },
    });
    if (!material) throw new NotFoundException('Material no encontrado');
    return material;
  }

  private async obtenerEntrega(id: number): Promise<Entrega> {
    const entrega = await this.entregas.findOne({
      where: { id },
      relations: { actividad: { grupoMateria: { grupo: true, docente: true } }, alumno: true },
    });
    if (!entrega || !entrega.archivoRuta) throw new NotFoundException('Entrega no encontrada');
    return entrega;
  }

  private async validarAccesoMaterial(material: Material, user: JwtUser): Promise<void> {
    const grupo = material.grupoMateria.grupo;
    if (user.roles.includes('SUPERADMIN')) return;
    if (user.roles.includes('ADMINISTRATIVO')) {
      await this.scope.validarGestion(user, grupo.plantelId);
      return;
    }
    if (user.roles.includes('MAESTRO') && material.grupoMateria.docente?.usuarioId === user.sub && grupoVigente(grupo))
      return;
    if (
      user.roles.includes('ALUMNO') &&
      ((await this.alumnoInscritoEnGrupo(grupo.id, user.sub)) ||
        (await recursaClase(this.inscripciones.manager, user.sub, material.grupoMateria.id)))
    )
      return;
    throw new ForbiddenException('No tienes acceso a este material');
  }

  private async validarAccesoEntrega(entrega: Entrega, user: JwtUser): Promise<void> {
    const grupo = entrega.actividad.grupoMateria.grupo;
    if (user.roles.includes('SUPERADMIN')) return;
    if (user.roles.includes('ADMINISTRATIVO')) {
      await this.scope.validarGestion(user, grupo.plantelId);
      return;
    }
    if (
      user.roles.includes('MAESTRO') &&
      entrega.actividad.grupoMateria.docente?.usuarioId === user.sub &&
      grupoVigente(grupo)
    )
      return;
    if (user.roles.includes('ALUMNO') && entrega.alumno.usuarioId === user.sub) return;
    throw new ForbiddenException('No tienes acceso a esta entrega');
  }

  /** El alumno tiene inscripción ACTIVA en el grupo (mismo patrón EXISTS que reportes.service.ts). */
  private async alumnoInscritoEnGrupo(grupoId: number, usuarioId: number): Promise<boolean> {
    const total = await this.inscripciones
      .createQueryBuilder('i')
      .where('i.grupo_id = :grupoId', { grupoId })
      .andWhere('i.estatus = :activa', { activa: 'ACTIVA' })
      .andWhere(
        'EXISTS (SELECT 1 FROM alumnos al INNER JOIN grupos g ON g.id = i.grupo_id INNER JOIN ciclos_escolares c ON c.id = g.ciclo_id INNER JOIN planteles p ON p.id = g.plantel_id WHERE al.id = i.alumno_id AND al.usuario_id = :usuarioId AND al.estatus = :alumnoActivo AND g.activo = :grupoActivo AND c.activo = :grupoActivo AND p.activo = :grupoActivo)',
        { usuarioId, grupoActivo: true, alumnoActivo: 'ACTIVO' },
      )
      .getCount();
    return total > 0;
  }

  /** Reconstruye el JwtUser (con roles vigentes) a partir del `sub` del enlace firmado. */
  private async usuarioDesdeToken(payload: EnlacePayload): Promise<JwtUser> {
    const usuario = await this.usuarios.findOne({ where: { id: payload.sub, activo: true } });
    if (
      !usuario ||
      usuario.activacionPendiente ||
      usuario.passwordChangeRequired ||
      usuario.sessionVersion !== payload.ver
    )
      throw new UnauthorizedException('Enlace inválido o sesión revocada');
    const sesion = await this.usuarios.manager
      .getRepository(Sesion)
      .findOne({ where: { id: payload.sid, usuarioId: usuario.id, revocada: false } });
    if (
      !sesion ||
      sesion.expiraEn <= new Date() ||
      sesion.version !== payload.ver ||
      sesionInactiva(sesion.ultimaActividadEn, new Date())
    )
      throw new UnauthorizedException('La sesión del enlace fue revocada');
    if (!usuario.email) throw new UnauthorizedException('La cuenta requiere correo institucional');
    return {
      sub: usuario.id,
      email: usuario.email,
      nombre: usuario.nombreCompleto,
      roles: usuario.roles.map((r) => r.clave),
      ver: payload.ver,
      sid: payload.sid,
      kind: 'ACCESS',
    };
  }

  private firmar(payload: Pick<EnlacePayload, 'sub' | 'rec' | 'id'>, user: JwtUser): string {
    if (!user.sid || !Number.isInteger(user.ver))
      throw new UnauthorizedException('La sesión no tiene identificador válido');
    return this.jwt.sign({ ...payload, sid: user.sid, ver: user.ver, kind: 'FILE' }, { expiresIn: '5m' });
  }

  private verificarToken(token: string, rec: RecursoArchivo, id: number): EnlacePayload {
    let payload: EnlacePayload;
    try {
      payload = this.jwt.verify<EnlacePayload>(token);
    } catch {
      throw new UnauthorizedException('Enlace inválido o expirado');
    }
    if (payload.rec !== rec || payload.id !== id) {
      throw new ForbiddenException('El enlace no corresponde a este archivo');
    }
    if (
      payload.kind !== 'FILE' ||
      typeof payload.sid !== 'string' ||
      !payload.sid ||
      !Number.isInteger(payload.sub) ||
      !Number.isInteger(payload.ver)
    )
      throw new UnauthorizedException('Enlace inválido');
    return payload;
  }

  private enviarArchivo(
    res: Response,
    archivoRuta: string,
    archivoNombre: string,
    mime = 'application/octet-stream',
    disposicion: 'inline' | 'attachment' = 'inline',
  ) {
    const uploadsDir = uploadsPath(this.config.get<string>('UPLOADS_DIR') || 'uploads');
    const ruta = join(uploadsDir, basename(archivoRuta));
    if (!existsSync(ruta)) throw new NotFoundException('Archivo no encontrado');
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', contentDisposition(archivoNombre, disposicion));
    createReadStream(ruta)
      .on('error', () => {
        if (!res.headersSent) res.status(404).end();
        else res.destroy();
      })
      .pipe(res);
  }
}
