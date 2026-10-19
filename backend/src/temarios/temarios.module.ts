import { Module } from '@nestjs/common';
import { PlantelesModule } from '../planteles/planteles.module';
import { TemariosService } from './temarios.service';
import { TemariosController } from './temarios.controller';
@Module({ imports: [PlantelesModule], providers: [TemariosService], controllers: [TemariosController], exports: [TemariosService] })
export class TemariosModule {}
