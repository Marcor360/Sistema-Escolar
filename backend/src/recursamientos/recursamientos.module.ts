import { Module } from '@nestjs/common';
import { PlantelesModule } from '../planteles/planteles.module';
import { RecursamientosController } from './recursamientos.controller';
import { RecursamientosService } from './recursamientos.service';
@Module({ imports:[PlantelesModule], controllers:[RecursamientosController], providers:[RecursamientosService] })
export class RecursamientosModule {}
