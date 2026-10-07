import { PushService } from './push.service';
import { ForbiddenException, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as nodemailer from 'nodemailer';
import { Notificacion } from '../entities/notificacion.entity';
import { Usuario } from '../entities/usuario.entity';
import { Alumno } from '../entities/alumno.entity';
import { UsuarioPlantel } from '../entities/usuario-plantel.entity';
import { JwtUser } from '../common/current-user.decorator';
import { ScopeService } from '../planteles/scope.service';
import { In } from 'typeorm';

@Injectable()
export class NotificacionesService {
  private readonly logger = new Logger(NotificacionesService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(
    @InjectRepository(Notificacion) private readonly repo: Repository<Notificacion>,
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    @InjectRepository(Alumno) private readonly alumnos: Repository<Alumno>,
    @InjectRepository(UsuarioPlantel) private readonly usuarioPlanteles: Repository<UsuarioPlantel>,
    private readonly scope: ScopeService,
    private readonly config: ConfigService,
    @Optional() private readonly push?: PushService,
  ) {
    const host = this.config.get<string>('SMTP_HOST');
    const port = Number(this.config.get('SMTP_PORT')) || 587;
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    const from = this.config.get<string>('SMTP_FROM');
    const produccion = this.config.get<string>('NODE_ENV') === 'production' &&
      this.config.get<string>('APP_ENV') !== 'staging';
    if (produccion && (!host || !user || !pass || !from)) {
      throw new Error('SMTP_HOST, SMTP_USER, SMTP_PASS y SMTP_FROM son obligatorios en produccion');
    }
    if ((user && !pass) || (!user && pass)) throw new Error('SMTP_USER y SMTP_PASS deben configurarse juntos');
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        ...(user && pass ? { auth: { user, pass } } : {}),
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

  async crear(usuarioId: number, titulo: string, mensaje: string, tipo: Notificacion['tipo'] = 'GENERAL') {
    const notificacion = await this.repo.save(this.repo.create({ usuarioId, titulo, mensaje, tipo }));
    await this.push?.encolar(notificacion).catch(() => this.logger.warn('Push pendiente; la notificación permanece disponible en la app'));
    return notificacion;
  }

  /** Difusión a usuarios específicos o a todos los que tengan un rol. */
  async difundir(titulo: string, mensaje: string, opts: { usuarioIds?: number[]; rol?: string }, user: JwtUser) {
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
    if (!user.roles.includes('SUPERADMIN')) {
      const permitidos = await this.scope.plantelesDe(user);
      if (permitidos === null) throw new ForbiddenException('No se pudo determinar el alcance del usuario');
      const [asignaciones, alumnos] = await Promise.all([
        this.usuarioPlanteles.find({ where: { usuarioId: In(ids), plantelId: In(permitidos), activo: true } }),
        this.alumnos.find({ where: { usuarioId: In(ids), plantelId: In(permitidos) } }),
      ]);
      const visibles = new Set([
        ...asignaciones.map((a) => a.usuarioId),
        ...alumnos.map((a) => a.usuarioId),
      ]);
      if (opts.usuarioIds?.some((id) => !visibles.has(id))) {
        throw new ForbiddenException('Uno o más destinatarios quedan fuera del alcance de tus planteles');
      }
      ids = ids.filter((id) => visibles.has(id));
    }
    if (ids.length === 0) return { enviadas: 0 };
    for (const usuarioId of ids) await this.crear(usuarioId, titulo, mensaje);
    return { enviadas: ids.length };
  }

  /** Envía correo real si hay SMTP configurado; si no, lo registra en consola. */
  async enviarEmail(to: string, subject: string, html: string) {
    if (!this.transporter) {
      this.logger.log('SMTP no configurado: correo no enviado');
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
