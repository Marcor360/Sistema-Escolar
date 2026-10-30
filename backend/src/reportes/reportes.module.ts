import { BoletasBandejaService } from '../boletas/boletas-bandeja.service';
import { BoletasService } from '../boletas/boletas.service';
import { BoletasController } from '../boletas/boletas.controller';
import { BoletaRespuesta } from '../entities/boleta-respuesta.entity';
import { FormatosEscolaresController } from './formatos-escolares.controller';
import { FormatosEscolaresService } from './formatos-escolares.service';
import { CalificacionesModule } from '../calificaciones/calificaciones.module';
import { BoletaMovilController } from './boleta-movil.controller';
import { ArchivosModule } from '../archivos/archivos.module';
import { Module } from '@nestjs/common';
import { ConfiguracionModule } from '../configuracion/configuracion.module';
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
import { AlumnosModule } from '../alumnos/alumnos.module';
import { PlantelesModule } from '../planteles/planteles.module';

@Module({
  imports: [
    CalificacionesModule,
    ArchivosModule,
    TypeOrmModule.forFeature([BoletaRespuesta, Alumno, Docente, Grupo, GrupoMateria, Calificacion, Pago]),
    FinanzasModule,
    DocentesModule,
    AlumnosModule,
    PlantelesModule,
    ConfiguracionModule,
  ],
  providers: [BoletasBandejaService, BoletasService, ReportesService, FormatosEscolaresService],
  controllers: [BoletasController, ReportesController, BoletaMovilController, FormatosEscolaresController],
})
export class ReportesModule {}
