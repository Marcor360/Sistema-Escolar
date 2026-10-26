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
import { FichasController } from './fichas.controller';
import { FichasService } from './fichas.service';
import { ProgramacionesCobroController } from './programaciones-cobro.controller';
import { ProgramacionesCobroService } from './programaciones-cobro.service';
import { ProgramacionCobro } from '../entities/programacion-cobro.entity';
import { CuentaDeposito } from '../entities/cuenta-deposito.entity';
import { ConfiguracionModule } from '../configuracion/configuracion.module';
import { AlumnosModule } from '../alumnos/alumnos.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { PlantelesModule } from '../planteles/planteles.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Cargo, ConceptoPago, Pago, OrdenPago, Inscripcion, Grupo, BitacoraFinanciera, PlantillaCorreo, CuentaDeposito, ProgramacionCobro,
    ]),
    AlumnosModule,
    NotificacionesModule,
    PlantelesModule,
    ConfiguracionModule,
  ],
  controllers: [FinanzasController, FichasController, ProgramacionesCobroController],
  providers: [
    ConceptosService, CargosService, PagosService, OrdenesService,
    CobranzaService, BitacoraFinancieraService, OpenpayService, FichasService, ProgramacionesCobroService,
  ],
  exports: [CargosService, PagosService],
})
export class FinanzasModule {}
