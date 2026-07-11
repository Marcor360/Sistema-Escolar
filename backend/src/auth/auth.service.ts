import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
  constructor(
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    @InjectRepository(PasswordResetToken) private readonly tokens: Repository<PasswordResetToken>,
    @InjectRepository(BitacoraActividad) private readonly bitacora: Repository<BitacoraActividad>,
    private readonly jwt: JwtService,
    private readonly notificaciones: NotificacionesService,
    private readonly config: ConfigService,
  ) {}

  async login(email: string, password: string, portal: Portal = 'WEB', ip?: string) {
    const usuario = await this.usuarios.findOne({ where: { email, activo: true } });
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
    };
    const expiresIn = portal === 'MOVIL'
      ? this.config.get<string>('JWT_EXPIRES_MOVIL') || this.config.get<string>('JWT_EXPIRES') || '8h'
      : this.config.get<string>('JWT_EXPIRES') || '8h';
    return { accessToken: this.jwt.sign(payload, { expiresIn }), usuario: payload };
  }

  async me(user: JwtUser) {
    const usuario = await this.usuarios.findOne({ where: { id: user.sub } });
    if (!usuario) throw new UnauthorizedException();
    const rest: Partial<Usuario> = { ...usuario };
    delete rest.passwordHash;
    return { ...rest, nombreCompleto: usuario.nombreCompleto };
  }

  /** Cambio de contraseña del propio usuario: exige la contraseña actual. */
  async cambiarPassword(usuarioId: number, actual: string, nueva: string) {
    const usuario = await this.usuarios.findOne({ where: { id: usuarioId, activo: true } });
    if (!usuario || !(await bcrypt.compare(actual, usuario.passwordHash))) {
      throw new UnauthorizedException('La contraseña actual no es correcta');
    }
    await this.usuarios.update(usuarioId, { passwordHash: await bcrypt.hash(nueva, 10) });
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
    );
    return { mensaje: 'Si el correo existe, se enviaron instrucciones' };
  }

  async resetPassword(token: string, password: string) {
    const registro = await this.tokens.findOne({ where: { token: this.hashToken(token), usado: false } });
    if (!registro || registro.expiraEn < new Date()) {
      throw new BadRequestException('Token inválido o expirado');
    }
    await this.usuarios.update(registro.usuarioId, {
      passwordHash: await bcrypt.hash(password, 10),
    });
    await this.tokens.update(registro.id, { usado: true });
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
      .catch(() => undefined);
  }
}
