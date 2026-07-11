import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Calificacion } from '../entities/calificacion.entity';
import { GrupoMateria } from '../entities/grupo-materia.entity';
import { CalificacionesService } from './calificaciones.service';
import { CalificacionesController } from './calificaciones.controller';
import { DocentesModule } from '../docentes/docentes.module';
import { AlumnosModule } from '../alumnos/alumnos.module';
import { Inscripcion } from '../entities/inscripcion.entity';
import { PlantelesModule } from '../planteles/planteles.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Calificacion, GrupoMateria, Inscripcion]),
    DocentesModule,
    AlumnosModule,
    PlantelesModule,
  ],
  providers: [CalificacionesService],
  controllers: [CalificacionesController],
  exports: [CalificacionesService],
})
export class CalificacionesModule {}
