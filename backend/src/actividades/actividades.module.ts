import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Actividad } from '../entities/actividad.entity';
import { Entrega } from '../entities/entrega.entity';
import { Material } from '../entities/material.entity';
import { GrupoMateria } from '../entities/grupo-materia.entity';
import { Inscripcion } from '../entities/inscripcion.entity';
import { ActividadesService } from './actividades.service';
import { ActividadesController } from './actividades.controller';
import { AlumnosModule } from '../alumnos/alumnos.module';
import { DocentesModule } from '../docentes/docentes.module';
import { PlantelesModule } from '../planteles/planteles.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Actividad, Entrega, Material, GrupoMateria, Inscripcion]),
    AlumnosModule,
    DocentesModule,
    PlantelesModule,
  ],
  providers: [ActividadesService],
  controllers: [ActividadesController],
})
export class ActividadesModule {}
