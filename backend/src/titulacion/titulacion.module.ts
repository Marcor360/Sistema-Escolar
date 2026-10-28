import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Alumno } from '../entities/alumno.entity';
import { CarreraPlan } from '../entities/carrera-plan.entity';
import { EgresoAlumno } from '../entities/egreso-alumno.entity';
import { TitulacionExpediente } from '../entities/titulacion-expediente.entity';
import { TitulacionFirmante } from '../entities/titulacion-firmante.entity';
import { FirmantesController } from './firmantes.controller';
import { FirmantesService } from './firmantes.service';
import { PlantelesModule } from '../planteles/planteles.module';
import { TitulacionController } from './titulacion.controller';
import { TitulacionService } from './titulacion.service';

@Module({
  imports: [TypeOrmModule.forFeature([TitulacionExpediente, EgresoAlumno, CarreraPlan, Alumno, TitulacionFirmante]), PlantelesModule],
  providers: [TitulacionService, FirmantesService],
  controllers: [TitulacionController, FirmantesController],
})
export class TitulacionModule {}
