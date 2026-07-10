import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { typeOrmConfig } from './config/typeorm.config';
import { BitacoraInterceptor } from './common/bitacora.interceptor';
import { BitacoraActividad } from './entities/bitacora-actividad.entity';
import { AuthModule } from './auth/auth.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { AlumnosModule } from './alumnos/alumnos.module';
import { DocentesModule } from './docentes/docentes.module';
import { AcademicoModule } from './academico/academico.module';
import { ActividadesModule } from './actividades/actividades.module';
import { CalificacionesModule } from './calificaciones/calificaciones.module';
import { CalendarioModule } from './calendario/calendario.module';
import { NotificacionesModule } from './notificaciones/notificaciones.module';
import { FinanzasModule } from './finanzas/finanzas.module';
import { ReportesModule } from './reportes/reportes.module';
import { PlantelesModule } from './planteles/planteles.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    TypeOrmModule.forRootAsync({ inject: [ConfigService], useFactory: typeOrmConfig }),
    TypeOrmModule.forFeature([BitacoraActividad]),
    AuthModule,
    UsuariosModule,
    AlumnosModule,
    DocentesModule,
    AcademicoModule,
    ActividadesModule,
    CalificacionesModule,
    CalendarioModule,
    NotificacionesModule,
    FinanzasModule,
    ReportesModule,
    PlantelesModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: BitacoraInterceptor },
  ],
})
export class AppModule {}
