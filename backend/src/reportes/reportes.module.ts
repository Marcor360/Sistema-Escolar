import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Alumno } from '../entities/alumno.entity';
import { Docente } from '../entities/docente.entity';
import { Grupo } from '../entities/grupo.entity';
import { GrupoMateria } from '../entities/grupo-materia.entity';
import { Calificacion } from '../entities/calificacion.entity';
import { Pago } from '../entities/pago.entity';
import { ReportesService } from './reportes.service';
import { ReportesController } from './reportes.controller';
import { FinanzasModule } from '../finanzas/finanzas.module';
import { DocentesModule } from '../docentes/docentes.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Alumno, Docente, Grupo, GrupoMateria, Calificacion, Pago]),
    FinanzasModule,
    DocentesModule,
  ],
  providers: [ReportesService],
  controllers: [ReportesController],
})
export class ReportesModule {}
