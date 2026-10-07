import { PushService } from './push.service';
import { PushController } from './push.controller';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notificacion } from '../entities/notificacion.entity';
import { Usuario } from '../entities/usuario.entity';
import { Alumno } from '../entities/alumno.entity';
import { UsuarioPlantel } from '../entities/usuario-plantel.entity';
import { PlantelesModule } from '../planteles/planteles.module';
import { NotificacionesService } from './notificaciones.service';
import { NotificacionesController } from './notificaciones.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Notificacion, Usuario, Alumno, UsuarioPlantel]), PlantelesModule],
  providers: [NotificacionesService, PushService],
  controllers: [NotificacionesController, PushController],
  exports: [NotificacionesService],
})
export class NotificacionesModule {}
