import { Module } from '@nestjs/common';
import { PlantelesModule } from '../planteles/planteles.module';
import { AnaliticaService } from './analitica.service';
import { AnaliticaController } from './analitica.controller';
@Module({ imports: [PlantelesModule], providers: [AnaliticaService], controllers: [AnaliticaController] })
export class AnaliticaModule {}
