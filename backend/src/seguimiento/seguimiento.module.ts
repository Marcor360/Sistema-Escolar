import { CalidadService } from './calidad.service';
import { Module } from '@nestjs/common';
import { PlantelesModule } from '../planteles/planteles.module';
import { FinanzasModule } from '../finanzas/finanzas.module';
import { AsistenciasService } from './asistencias.service';
import { AsistenciasController } from './asistencias.controller';
import { SeguimientoService } from './seguimiento.service';
import { SeguimientoController } from './seguimiento.controller';
import { TramitesService } from './tramites.service';
import { BancoService } from './banco.service';
@Module({
  imports: [PlantelesModule, FinanzasModule],
  providers: [CalidadService, AsistenciasService, SeguimientoService, TramitesService, BancoService],
  controllers: [AsistenciasController, SeguimientoController],
})
export class SeguimientoModule {}
