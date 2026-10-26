import { DataSource } from 'typeorm';
import { PreferenciaNotificacion } from '../entities/preferencia-notificacion.entity';
import { randomUUID } from 'crypto';
import { ServiceUnavailableException } from '@nestjs/common';
import { PushService } from './push.service';
import { ForbiddenException, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as nodemailer from 'nodemailer';
import { Notificacion } from '../entities/notificacion.entity';
import { proveedorCorreoPredeterminado } from '../common/proveedor-correo';
import { CorreoMicrosoftService } from './correo-microsoft.service';
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
    @Optional() private readonly microsoft?: CorreoMicrosoftService,
    @Optional() private readonly ds?: DataSource,
  ) {
    const host = this.config.get<string>('SMTP_HOST');
    const puertoConfigurado = this.config.get<string>('SMTP_PORT') || '587';
    const port = Number(puertoConfigurado);
    if (!/^\d+$/.test(puertoConfigurado) || !Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error('SMTP_PORT debe ser un puerto valido entre 1 y 65535');
    }
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    const from = this.config.get<string>('SMTP_FROM');
    const requerido = this.config.get<string>('SMTP_REQUIRED') === 'true';
    const produccion = this.config.get<string>('NODE_ENV') === 'production' &&
      this.config.get<string>('APP_ENV') !== 'staging';
    if ((produccion || requerido) && (!host || !user || !pass || !from)) {
      throw new Error('SMTP_HOST, SMTP_USER, SMTP_PASS y SMTP_FROM son obligatorios en produccion');
    }
    if ((user && !pass) || (!user && pass)) throw new Error('SMTP_USER y SMTP_PASS deben configurarse juntos');
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        pool: true,
        maxConnections: 1,
        maxMessages: 100,
        // En entornos desplegados, impedir SMTP en texto claro si el servidor no ofrece STARTTLS.
        requireTLS: port !== 465 && (this.config.get<string>('NODE_ENV') === 'production' || this.config.get<string>('APP_ENV') === 'staging'),
        tls: { rejectUnauthorized: true },
        connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 30000,
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
    const notificacion = await this.repo.save(this.repo.create({ usuarioId, titulo, mensaje, tipo, pushPendiente: true }));
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

  /** La preferencia persistida se aplica por destinatario; nunca se sustituye silenciosamente un proveedor. */
  async enviarEmail(to: string, subject: string, html: string, messageId?: string, tipo?: Notificacion['tipo']): Promise<{simulado:boolean; omitido?:boolean}> {
    const usuario = await this.usuarios.findOne({ where: { email: to } });
    if (usuario && tipo && this.ds && (await this.ds.getRepository(PreferenciaNotificacion).findOneBy({usuarioId:usuario.id,tipo}))?.correo === false) return {simulado:false,omitido:true};
    const proveedor = usuario
      ? (usuario.correoProveedor ?? proveedorCorreoPredeterminado(usuario.roles.map((r) => r.clave)))
      : 'GODADDY';
    const correlacion = randomUUID();
    if (proveedor === 'MICROSOFT365') {
      if (!this.microsoft?.habilitado) {
        throw new ServiceUnavailableException('Correo Microsoft 365 no disponible para esta cuenta');
      }
      await this.microsoft.enviar(to, subject, html, correlacion, messageId);
      this.logger.log(`ACEPTADO_GRAPH correlacion=${correlacion}; recepción en buzón no verificada`);
      return { simulado: false };
    }
    if (proveedor !== 'GODADDY') {
      throw new ServiceUnavailableException('Proveedor de correo no válido para esta cuenta');
    }
    if (!this.transporter) {
      this.logger.log('SMTP no configurado: correo no enviado');
      return { simulado: true };
    }
    const from = this.config.get<string>('SMTP_FROM') || 'no-reply@escolar.mx';
    const dominio = from.trim().match(/@([a-z0-9.-]+)>?$/i)?.[1];
    const idMensaje = messageId || (dominio ? `${correlacion}@${dominio}` : undefined);
    const resultado = await this.transporter.sendMail({
      from,
      to,
      subject,
      html, ...(idMensaje ? { messageId: `<${idMensaje}>` } : {}),
      headers: { 'X-Sistema-Correlacion': correlacion },
    });
    if (!resultado || !Array.isArray(resultado.accepted) || resultado.accepted.length === 0 || resultado.rejected?.length) {
      this.logger.warn(`SMTP_RECHAZADO correlacion=${correlacion}`);
      throw new ServiceUnavailableException('El servidor de correo no aceptó todos los destinatarios');
    }
    // No registrar direcciones, asuntos, cuerpos, respuestas SMTP ni enlaces de acceso.
    this.logger.log(`ACEPTADO_SMTP correlacion=${correlacion}; recepción en buzón no verificada`);
    return { simulado: false };
  }
}
