import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as nodemailer from 'nodemailer';
import { Notificacion } from '../entities/notificacion.entity';
import { Usuario } from '../entities/usuario.entity';

@Injectable()
export class NotificacionesService {
  private readonly logger = new Logger(NotificacionesService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(
    @InjectRepository(Notificacion) private readonly repo: Repository<Notificacion>,
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    private readonly config: ConfigService,
  ) {
    const host = this.config.get<string>('SMTP_HOST');
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(this.config.get('SMTP_PORT')) || 587,
        secure: false,
        auth: {
          user: this.config.get<string>('SMTP_USER'),
          pass: this.config.get<string>('SMTP_PASS'),
        },
      });
    }
  }

  misNotificaciones(usuarioId: number) {
    return this.repo.find({ where: { usuarioId }, order: { createdAt: 'DESC' }, take: 100 });
  }

  async marcarLeida(id: number, usuarioId: number) {
    await this.repo.update({ id, usuarioId }, { leida: true });
    return { ok: true };
  }

  crear(usuarioId: number, titulo: string, mensaje: string, tipo: Notificacion['tipo'] = 'GENERAL') {
    return this.repo.save(this.repo.create({ usuarioId, titulo, mensaje, tipo }));
  }

  /** Difusión a usuarios específicos o a todos los que tengan un rol. */
  async difundir(titulo: string, mensaje: string, opts: { usuarioIds?: number[]; rol?: string }) {
    let ids = opts.usuarioIds ?? [];
    if (opts.rol) {
      const usuarios = await this.usuarios
        .createQueryBuilder('u')
        .innerJoin('u.roles', 'r', 'r.clave = :rol', { rol: opts.rol })
        .select('u.id', 'id')
        .getRawMany<{ id: number }>();
      ids = ids.concat(usuarios.map((u) => u.id));
    }
    ids = [...new Set(ids)];
    if (ids.length === 0) return { enviadas: 0 };
    await this.repo.insert(ids.map((usuarioId) => ({ usuarioId, titulo, mensaje })));
    return { enviadas: ids.length };
  }

  /** Envía correo real si hay SMTP configurado; si no, lo registra en consola. */
  async enviarEmail(to: string, subject: string, html: string) {
    if (!this.transporter) {
      this.logger.log(`[EMAIL simulado] para=${to} asunto="${subject}"`);
      return { simulado: true };
    }
    await this.transporter.sendMail({
      from: this.config.get<string>('SMTP_FROM') || 'no-reply@escolar.mx',
      to,
      subject,
      html,
    });
    return { simulado: false };
  }
}
