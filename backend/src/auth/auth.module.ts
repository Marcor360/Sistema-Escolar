import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from '../entities/usuario.entity';
import { PasswordResetToken } from '../entities/password-reset-token.entity';
import { BitacoraActividad } from '../entities/bitacora-actividad.entity';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Usuario, PasswordResetToken, BitacoraActividad]),
    PassportModule,
    NotificacionesModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET') || 'cambiar-en-produccion';
        if (process.env.NODE_ENV === 'production' && secret === 'cambiar-en-produccion') {
          throw new Error('Seguridad: define un JWT_SECRET real en producción');
        }
        return { secret, signOptions: { expiresIn: config.get<string>('JWT_EXPIRES') || '8h' } };
      },
    }),
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
})
export class AuthModule {}
