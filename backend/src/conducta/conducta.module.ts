import { Module } from '@nestjs/common';
import { PlantelesModule } from '../planteles/planteles.module';
import { ConductaService } from './conducta.service';
import { ConductaController } from './conducta.controller';
@Module({ imports: [PlantelesModule], providers: [ConductaService], controllers: [ConductaController] })
export class ConductaModule {}
