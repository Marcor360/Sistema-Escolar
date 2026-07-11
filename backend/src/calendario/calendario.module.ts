import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Alumno } from '../entities/alumno.entity';
import { Docente } from '../entities/docente.entity';
import { EventoCalendario } from '../entities/evento-calendario.entity';
import { Grupo } from '../entities/grupo.entity';
import { GrupoMateria } from '../entities/grupo-materia.entity';
import { Inscripcion } from '../entities/inscripcion.entity';
import { PlantelesModule } from '../planteles/planteles.module';
import { CalendarioController } from './calendario.controller';
import { CalendarioService } from './calendario.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([EventoCalendario, Grupo, GrupoMateria, Inscripcion, Alumno, Docente]),
    PlantelesModule,
  ],
  providers: [CalendarioService],
  controllers: [CalendarioController],
})
export class CalendarioModule {}
