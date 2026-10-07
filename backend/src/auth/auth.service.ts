import { BadRequestException, ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { createHash, randomUUID } from 'crypto';
import { Usuario } from '../entities/usuario.entity';
import { PasswordResetToken } from '../entities/password-reset-token.entity';
import { BitacoraActividad } from '../entities/bitacora-actividad.entity';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { JwtUser } from '../common/current-user.decorator';
import { MENSAJES_PORTAL, Portal, ROLES_POR_PORTAL } from '../common/portales';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    @InjectRepository(PasswordResetToken) private readonly tokens: Repository<PasswordResetToken>,
    @InjectRepository(BitacoraActividad) private readonly bitacora: Repository<BitacoraActividad>,
    private readonly jwt: JwtService,
    private readonly notificaciones: NotificacionesService,
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  async login(email: string, password: string, portal: Portal = 'WEB', ip?: string) {
    const usuario = await this.usuarios.findOne({
      where: { email, activo: true },
      select: ['id', 'email', 'passwordHash', 'nombre', 'apellidoPaterno', 'apellidoMaterno', 'sessionVersion'],
    });
    if (!usuario || !(await bcrypt.compare(password, usuario.passwordHash))) {
      await this.registrarLoginFallido(usuario?.id ?? null, 'FALLIDO', ip);
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const roles = usuario.roles.map((r) => r.clave);
    if (!roles.some((rol) => (ROLES_POR_PORTAL[portal] as string[]).includes(rol))) {
      await this.registrarLoginFallido(usuario.id, 'PORTAL_RECHAZADO', ip);
      throw new ForbiddenException(MENSAJES_PORTAL[portal]);
    }
    const payload: JwtUser = {
      sub: usuario.id,
      email: usuario.email,
      nombre: usuario.nombreCompleto,
      roles,
      ver: usuario.sessionVersion ?? 0,
    };
    const expiresIn = portal === 'MOVIL'
      ? this.config.get<string>('JWT_EXPIRES_MOVIL') || this.config.get<string>('JWT_EXPIRES') || '8h'
      : this.config.get<string>('JWT_EXPIRES') || '8h';
    return {
      accessToken: this.jwt.sign(payload, { expiresIn: expiresIn as JwtSignOptions['expiresIn'] }),
      usuario: payload,
    };
  }

  async me(user: JwtUser) {
    const usuario = await this.usuarios.findOne({ where: { id: user.sub } });
    if (!usuario) throw new UnauthorizedException();
    return {
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      apellidoPaterno: usuario.apellidoPaterno,
      apellidoMaterno: usuario.apellidoMaterno,
      nombreCompleto: usuario.nombreCompleto,
      telefono: usuario.telefono,
      activo: usuario.activo,
      roles: usuario.roles.map((rol) => ({ id: rol.id, clave: rol.clave, nombre: rol.nombre })),
    };
  }

  /** Revoca todas las sesiones emitidas con la versión actual del usuario. */
  async logout(user: JwtUser) {
    const resultado = await this.usuarios.increment(
      { id: user.sub, activo: true, sessionVersion: user.ver ?? 0 },
      'sessionVersion',
      1,
    );
    if (resultado.affected !== 1) throw new UnauthorizedException('La sesión ya no está activa');
    return { mensaje: 'Sesión cerrada' };
  }

  /** Cambio de contraseña del propio usuario: exige la contraseña actual. */
  async cambiarPassword(usuarioId: number, actual: string, nueva: string) {
    await this.dataSource.transaction(async (manager) => {
      const usuarios = manager.getRepository(Usuario);
      const usuario = await usuarios.findOne({
        where: { id: usuarioId, activo: true }, select: ['id', 'passwordHash', 'sessionVersion'],
      });
      if (!usuario || !(await bcrypt.compare(actual, usuario.passwordHash))) {
        throw new UnauthorizedException('La contraseña actual no es correcta');
      }
      usuario.passwordHash = await bcrypt.hash(nueva, 10);
      usuario.sessionVersion = (usuario.sessionVersion ?? 0) + 1;
      await usuarios.save(usuario);
      await manager.getRepository(PasswordResetToken).update(
        { usuarioId, usado: false }, { usado: true },
      );
    });
    return { mensaje: 'Contraseña actualizada' };
  }

  /** Genera token de recuperación (1 hora). Se envía por correo si hay SMTP; en BD solo se guarda su hash. */
  async forgotPassword(email: string) {
    const usuario = await this.usuarios.findOne({ where: { email, activo: true } });
    // Respuesta idéntica exista o no el correo (no revelar cuentas)
    if (!usuario) return { mensaje: 'Si el correo existe, se enviaron instrucciones' };

    await this.tokens.update({ usuarioId: usuario.id, usado: false }, { usado: true });

    const token = randomUUID().replace(/-/g, '');
    await this.tokens.save(
      this.tokens.create({
        usuarioId: usuario.id,
        token: this.hashToken(token),
        expiraEn: new Date(Date.now() + 60 * 60 * 1000),
      }),
    );
    await this.notificaciones.enviarEmail(
      usuario.email,
      'Recuperación de contraseña',
      `<p>Hola ${usuario.nombre}:</p><p>Tu código de recuperación es: <b>${token}</b></p><p>Vence en 1 hora.</p>`,
    ).catch((error: unknown) => {
      this.logger.error('No se pudo entregar el correo de recuperacion de contrasena', error);
    });
    return { mensaje: 'Si el correo existe, se enviaron instrucciones' };
  }

  async resetPassword(token: string, password: string) {
    const registro = await this.tokens.findOne({ where: { token: this.hashToken(token), usado: false } });
    if (!registro || registro.expiraEn < new Date()) {
      throw new BadRequestException('Token inválido o expirado');
    }
    await this.dataSource.transaction(async (manager) => {
      const tokens = manager.getRepository(PasswordResetToken);
      const consumo = await tokens.createQueryBuilder()
        .update(PasswordResetToken)
        .set({ usado: true })
        .where('id = :id AND usado = :usado AND expiraEn > :ahora', {
          id: registro.id, usado: false, ahora: new Date(),
        })
        .execute();
      if (consumo.affected !== 1) throw new BadRequestException('Token inválido o expirado');

      const usuarios = manager.getRepository(Usuario);
      const usuario = await usuarios.findOne({
        where: { id: registro.usuarioId, activo: true }, select: ['id', 'passwordHash', 'sessionVersion'],
      });
      if (!usuario) throw new UnauthorizedException('La cuenta ya no está activa');
      usuario.passwordHash = await bcrypt.hash(password, 10);
      usuario.sessionVersion = (usuario.sessionVersion ?? 0) + 1;
      await usuarios.save(usuario);
      await tokens.update({ usuarioId: registro.usuarioId, usado: false }, { usado: true });
    });
    return { mensaje: 'Contraseña actualizada' };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /** La bitácora nunca debe tumbar el login (mismo criterio que BitacoraInterceptor). */
  private async registrarLoginFallido(
    usuarioId: number | null,
    motivo: 'FALLIDO' | 'PORTAL_RECHAZADO',
    ip?: string,
  ) {
    await this.bitacora
      .insert({ usuarioId, metodo: 'POST', ruta: `auth/login:${motivo}`, ip: ip ?? null })
      .catch((): undefined => undefined);
  }
}
