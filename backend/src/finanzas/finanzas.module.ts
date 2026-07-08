import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cargo } from '../entities/cargo.entity';
import { ConceptoPago } from '../entities/concepto-pago.entity';
import { Pago } from '../entities/pago.entity';
import { OrdenPago } from '../entities/orden-pago.entity';
import { Inscripcion } from '../entities/inscripcion.entity';
import { Grupo } from '../entities/grupo.entity';
import { BitacoraFinanciera } from '../entities/bitacora-financiera.entity';
import { PlantillaCorreo } from '../entities/plantilla-correo.entity';
import { FinanzasController } from './finanzas.controller';
import { ConceptosService } from './conceptos.service';
import { CargosService } from './cargos.service';
import { PagosService } from './pagos.service';
import { OrdenesService } from './ordenes.service';
import { CobranzaService } from './cobranza.service';
import { BitacoraFinancieraService } from './bitacora-financiera.service';
import { OpenpayService } from './openpay.service';
import { AlumnosModule } from '../alumnos/alumnos.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Cargo, ConceptoPago, Pago, OrdenPago, Inscripcion, Grupo, BitacoraFinanciera, PlantillaCorreo,
    ]),
    AlumnosModule,
    NotificacionesModule,
  ],
  controllers: [FinanzasController],
  providers: [
    ConceptosService, CargosService, PagosService, OrdenesService,
    CobranzaService, BitacoraFinancieraService, OpenpayService,
  ],
  exports: [CargosService],
})
export class FinanzasModule {}
