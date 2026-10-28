import { ReinscripcionPeriodoService } from './reinscripcion-periodo.service';
import { Module } from '@nestjs/common';
import { AcademicoModule } from '../academico/academico.module';
import { PlantelesModule } from '../planteles/planteles.module';
import { CarteraController } from './cartera.controller';
import { CarteraService } from './cartera.service';
@Module({ imports: [AcademicoModule, PlantelesModule], controllers: [CarteraController], providers: [CarteraService, ReinscripcionPeriodoService] })
export class CarteraModule {}
