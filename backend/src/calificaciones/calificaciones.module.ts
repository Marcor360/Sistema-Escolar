import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Calificacion } from '../entities/calificacion.entity';
import { GrupoMateria } from '../entities/grupo-materia.entity';
import { CalificacionesService } from './calificaciones.service';
import { CalificacionesController } from './calificaciones.controller';
import { DocentesModule } from '../docentes/docentes.module';
import { AlumnosModule } from '../alumnos/alumnos.module';

@Module({
  imports: [TypeOrmModule.forFeature([Calificacion, GrupoMateria]), DocentesModule, AlumnosModule],
  providers: [CalificacionesService],
  controllers: [CalificacionesController],
  exports: [CalificacionesService],
})
export class CalificacionesModule {}
