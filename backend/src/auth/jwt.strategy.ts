import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { JwtUser } from '../common/current-user.decorator';
import { Usuario } from '../entities/usuario.entity';
import { Alumno } from '../entities/alumno.entity';
import { Docente } from '../entities/docente.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    @InjectRepository(Alumno) private readonly alumnos: Repository<Alumno>,
    @InjectRepository(Docente) private readonly docentes: Repository<Docente>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') || 'cambiar-en-produccion',
    });
  }

  async validate(payload: JwtUser): Promise<JwtUser> {
    const usuario = await this.usuarios.findOne({ where: { id: payload.sub, activo: true } });
    if (!usuario) throw new UnauthorizedException('La cuenta ya no está activa');
    if ((payload.ver ?? 0) !== (usuario.sessionVersion ?? 0)) {
      throw new UnauthorizedException('La sesión fue revocada; inicia sesión de nuevo');
    }
    const roles = usuario.roles.map((rol) => rol.clave);
    if (roles.includes('ALUMNO')) {
      const alumno = await this.alumnos.findOne({ where: { usuarioId: usuario.id, estatus: 'ACTIVO' } });
      if (!alumno) throw new UnauthorizedException('El expediente de alumno ya no está activo');
    }
    if (roles.includes('MAESTRO')) {
      const docente = await this.docentes.findOne({ where: { usuarioId: usuario.id, estatus: 'ACTIVO' } });
      if (!docente) throw new UnauthorizedException('El expediente de docente ya no está activo');
    }
    return {
      sub: usuario.id,
      email: usuario.email,
      nombre: usuario.nombreCompleto,
      roles,
      ver: usuario.sessionVersion ?? 0,
    };
  }
}
