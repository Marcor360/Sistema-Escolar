import { Module } from '@nestjs/common';
import { PreviewLimpiezaService } from './preview-limpieza.service';
import { PlantelesModule } from '../planteles/planteles.module';
import { ImportacionesController } from './importaciones.controller';
import { ImportacionesService } from './importaciones.service';
@Module({ imports: [PlantelesModule], controllers: [ImportacionesController], providers: [ImportacionesService, PreviewLimpiezaService] })
export class ImportacionesModule {}
