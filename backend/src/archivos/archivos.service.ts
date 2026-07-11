import { ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createReadStream, existsSync } from 'fs';
import { basename, extname, join } from 'path';
import type { Response } from 'express';
import { Material } from '../entities/material.entity';
import { Entrega } from '../entities/entrega.entity';
import { Inscripcion } from '../entities/inscripcion.entity';
import { Usuario } from '../entities/usuario.entity';
import { ScopeService } from '../planteles/scope.service';
import { JwtUser } from '../common/current-user.decorator';

type RecursoArchivo = 'material' | 'entrega';

interface EnlacePayload {
  sub: number;
  rec: RecursoArchivo;
  id: number;
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
  ) {}

  // ---- Materiales ----
  async enlaceMaterial(id: number, user: JwtUser) {
    const material = await this.obtenerMaterial(id);
    await this.validarAccesoMaterial(material, user);
    return { url: `/api/archivos/materiales/${id}?t=${this.firmar({ sub: user.sub, rec: 'material', id })}` };
  }

  async descargarMaterial(id: number, token: string, res: Response) {
    const payload = this.verificarToken(token, 'material', id);
    const material = await this.obtenerMaterial(id);
    const user = await this.usuarioDesdeToken(payload.sub);
    await this.validarAccesoMaterial(material, user);
    this.enviarArchivo(res, material.archivoRuta, material.archivoNombre, material.mime ?? undefined);
  }

  // ---- Entregas ----
  async enlaceEntrega(id: number, user: JwtUser) {
    const entrega = await this.obtenerEntrega(id);
    await this.validarAccesoEntrega(entrega, user);
    return { url: `/api/archivos/entregas/${id}?t=${this.firmar({ sub: user.sub, rec: 'entrega', id })}` };
  }

  async descargarEntrega(id: number, token: string, res: Response) {
    const payload = this.verificarToken(token, 'entrega', id);
    const entrega = await this.obtenerEntrega(id);
    const user = await this.usuarioDesdeToken(payload.sub);
    await this.validarAccesoEntrega(entrega, user);
    const mime = MIME_POR_EXTENSION[extname(entrega.archivoNombre ?? '').toLowerCase()] ?? 'application/octet-stream';
    this.enviarArchivo(res, entrega.archivoRuta as string, entrega.archivoNombre as string, mime);
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
    if (user.roles.includes('MAESTRO') && material.grupoMateria.docente?.usuarioId === user.sub) return;
    if (user.roles.includes('ALUMNO') && (await this.alumnoInscritoEnGrupo(grupo.id, user.sub))) return;
    throw new ForbiddenException('No tienes acceso a este material');
  }

  private async validarAccesoEntrega(entrega: Entrega, user: JwtUser): Promise<void> {
    const grupo = entrega.actividad.grupoMateria.grupo;
    if (user.roles.includes('SUPERADMIN')) return;
    if (user.roles.includes('ADMINISTRATIVO')) {
      await this.scope.validarGestion(user, grupo.plantelId);
      return;
    }
    if (user.roles.includes('MAESTRO') && entrega.actividad.grupoMateria.docente?.usuarioId === user.sub) return;
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
        'EXISTS (SELECT 1 FROM alumnos al WHERE al.id = i.alumno_id AND al.usuario_id = :usuarioId)',
        { usuarioId },
      )
      .getCount();
    return total > 0;
  }

  /** Reconstruye el JwtUser (con roles vigentes) a partir del `sub` del enlace firmado. */
  private async usuarioDesdeToken(usuarioId: number): Promise<JwtUser> {
    const usuario = await this.usuarios.findOne({ where: { id: usuarioId, activo: true } });
    if (!usuario) throw new UnauthorizedException('Enlace inválido o expirado');
    return {
      sub: usuario.id,
      email: usuario.email,
      nombre: usuario.nombreCompleto,
      roles: usuario.roles.map((r) => r.clave),
    };
  }

  private firmar(payload: EnlacePayload): string {
    return this.jwt.sign(payload, { expiresIn: '5m' });
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
    return payload;
  }

  private enviarArchivo(res: Response, archivoRuta: string, archivoNombre: string, mime = 'application/octet-stream') {
    const uploadsDir = join(process.cwd(), this.config.get<string>('UPLOADS_DIR') || 'uploads');
    const ruta = join(uploadsDir, basename(archivoRuta));
    if (!existsSync(ruta)) throw new NotFoundException('Archivo no encontrado');
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `inline; filename="${archivoNombre.replace(/"/g, "'")}"`);
    createReadStream(ruta).pipe(res);
  }
}
