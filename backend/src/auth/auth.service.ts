import { BadRequestException, ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { createHash, randomUUID } from 'crypto';
import { Sesion } from '../entities/sesion.entity';
import { Alumno } from '../entities/alumno.entity';
import { Docente } from '../entities/docente.entity';
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
      select: ['id', 'email', 'passwordHash', 'nombre', 'apellidoPaterno', 'apellidoMaterno', 'sessionVersion', 'passwordChangeRequired'],
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
    await this.validarExpediente(usuario.id, roles);
    const sesiones = this.dataSource.getRepository(Sesion);
    const sesion = sesiones.create({ id: randomUUID(), usuarioId: usuario.id, portal,
      version: usuario.sessionVersion ?? 0, expiraEn: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), revocada: false });
    const resultado = this.emitir(usuario, sesion);
    await sesiones.save(sesion);
    return resultado;
  }

  private emitir(usuario: Usuario, sesion: Sesion) {
    const payload: JwtUser = { sub: usuario.id, email: usuario.email, nombre: usuario.nombreCompleto,
      roles: usuario.roles.map((r) => r.clave), ver: usuario.sessionVersion ?? 0, sid: sesion.id, kind: 'ACCESS', passwordChangeRequired: usuario.passwordChangeRequired };
    const refreshToken = this.jwt.sign({ sub: usuario.id, sid: sesion.id, portal: sesion.portal,
      ver: sesion.version, kind: 'REFRESH', jti: randomUUID() }, { expiresIn: Math.max(1, Math.floor((sesion.expiraEn.getTime() - Date.now()) / 1000)) });
    sesion.refreshHash = this.hashToken(refreshToken);
    return { accessToken: this.jwt.sign(payload, { expiresIn: '15m' }), refreshToken, usuario: payload };
  }

  private async validarExpediente(usuarioId: number, roles: string[]) {
    for (const [rol, entidad] of [['ALUMNO', Alumno], ['MAESTRO', Docente]] as const) {
      if (roles.includes(rol) && !await this.dataSource.getRepository(entidad).findOne({ where: { usuarioId, estatus: 'ACTIVO' } })) {
        throw new UnauthorizedException('El expediente ya no está activo');
      }
    }
  }

  async refresh(token: string, portal: Portal) {
    let payload: { sid: string; sub: number; kind: string; portal: Portal };
    try { payload = this.jwt.verify(token); } catch { throw new UnauthorizedException('Refresh inválido o expirado'); }
    if (payload.kind !== 'REFRESH' || payload.portal !== portal || !payload.sid) throw new UnauthorizedException('Refresh inválido');
    // Un token anterior revoca la sesión. La revocación se confirma antes de devolver 401.
    const resultado = await this.dataSource.transaction(async (manager) => {
      const sesiones = manager.getRepository(Sesion);
      const sesion = await sesiones.findOne({ where: { id: payload.sid, usuarioId: payload.sub }, lock: { mode: 'pessimistic_write' } });
      if (!sesion || sesion.revocada || sesion.expiraEn <= new Date()) return null;
      if (sesion.refreshHash !== this.hashToken(token)) {
        sesion.revocada = true; await sesiones.save(sesion); return null;
      }
      const usuario = await manager.getRepository(Usuario).findOne({ where: { id: payload.sub, activo: true } });
      if (!usuario || sesion.version !== usuario.sessionVersion) return null;
      const roles = usuario.roles.map((r) => r.clave);
      if (!roles.some((r) => (ROLES_POR_PORTAL[portal] as string[]).includes(r))) return null;
      await this.validarExpediente(usuario.id, roles);
      const tokens = this.emitir(usuario, sesion);
      await sesiones.save(sesion);
      return tokens;
    });
    if (!resultado) throw new UnauthorizedException('La sesión ya no está activa');
    return resultado;
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
      passwordChangeRequired: usuario.passwordChangeRequired,
      roles: usuario.roles.map((rol) => ({ id: rol.id, clave: rol.clave, nombre: rol.nombre })),
    };
  }

  /** Revoca el dispositivo actual; la versión global se conserva para tokens anteriores. */
  async logout(user: JwtUser) {
    if (user.sid) {
      await this.dataSource.getRepository(Sesion).update({ id: user.sid, usuarioId: user.sub }, { revocada: true });
      return { mensaje: 'Sesión cerrada' };
    }
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
      if (actual === nueva) throw new BadRequestException('Elige una contraseña distinta de la temporal');
      const actualizado = await usuarios.update({ id: usuario.id, activo: true }, {
        passwordHash: await bcrypt.hash(nueva, 10), passwordChangeRequired: false,
        sessionVersion: () => 'COALESCE(session_version, 0) + 1',
      });
      if (actualizado.affected !== 1) throw new UnauthorizedException('La cuenta ya no está activa');
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
    ).catch(() => {
      this.logger.error('No se pudo entregar el correo de recuperacion de contrasena');
    });
    return { mensaje: 'Si el correo existe, se enviaron instrucciones' };
  }

  async resetPassword(token: string, password: string) {
    const registro = await this.tokens.findOne({ where: { token: this.hashToken(token), usado: false } });
    if (!registro || registro.expiraEn < new Date()) {
      throw new BadRequestException('Token inválido o expirado');
    }
    await this.dataSource.transaction(async (manager) => {
      // Mismo orden de bloqueo que cambio de contraseña: usuario antes de tokens.
      const usuarios = manager.getRepository(Usuario);
      const usuario = await usuarios.findOne({
        where: { id: registro.usuarioId, activo: true }, select: ['id'], lock: { mode: 'pessimistic_write' },
      });
      if (!usuario) throw new UnauthorizedException('La cuenta ya no está activa');
      const tokens = manager.getRepository(PasswordResetToken);
      const consumo = await tokens.createQueryBuilder()
        .update(PasswordResetToken)
        .set({ usado: true })
        .where('id = :id AND usado = :usado AND expiraEn > :ahora', {
          id: registro.id, usado: false, ahora: new Date(),
        })
        .execute();
      if (consumo.affected !== 1) throw new BadRequestException('Token inválido o expirado');

      const actualizado = await usuarios.update({ id: usuario.id, activo: true }, {
        passwordHash: await bcrypt.hash(password, 10), passwordChangeRequired: false,
        sessionVersion: () => 'COALESCE(session_version, 0) + 1',
      });
      if (actualizado.affected !== 1) throw new UnauthorizedException('La cuenta ya no está activa');
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
