import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { Usuario } from '../entities/usuario.entity';
import { PasswordResetToken } from '../entities/password-reset-token.entity';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { JwtUser } from '../common/current-user.decorator';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    @InjectRepository(PasswordResetToken) private readonly tokens: Repository<PasswordResetToken>,
    private readonly jwt: JwtService,
    private readonly notificaciones: NotificacionesService,
  ) {}

  async login(email: string, password: string) {
    const usuario = await this.usuarios.findOne({ where: { email, activo: true } });
    if (!usuario || !(await bcrypt.compare(password, usuario.passwordHash))) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const payload: JwtUser = {
      sub: usuario.id,
      email: usuario.email,
      nombre: usuario.nombreCompleto,
      roles: usuario.roles.map((r) => r.clave),
    };
    return { accessToken: this.jwt.sign(payload), usuario: payload };
  }

  async me(user: JwtUser) {
    const usuario = await this.usuarios.findOne({ where: { id: user.sub } });
    if (!usuario) throw new UnauthorizedException();
    const { passwordHash, ...rest } = usuario;
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

  /** Genera token de recuperación (1 hora). Se envía por correo si hay SMTP. */
  async forgotPassword(email: string) {
    const usuario = await this.usuarios.findOne({ where: { email, activo: true } });
    // Respuesta idéntica exista o no el correo (no revelar cuentas)
    if (!usuario) return { mensaje: 'Si el correo existe, se enviaron instrucciones' };

    const token = randomUUID().replace(/-/g, '');
    await this.tokens.save(
      this.tokens.create({
        usuarioId: usuario.id,
        token,
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
    const registro = await this.tokens.findOne({ where: { token, usado: false } });
    if (!registro || registro.expiraEn < new Date()) {
      throw new BadRequestException('Token inválido o expirado');
    }
    await this.usuarios.update(registro.usuarioId, {
      passwordHash: await bcrypt.hash(password, 10),
    });
    await this.tokens.update(registro.id, { usado: true });
    return { mensaje: 'Contraseña actualizada' };
  }
}
