import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfiguracionMarca, CuentaDeposito } from '../entities';
import { ConfiguracionBancoController } from './configuracion-banco.controller';
import { ConfiguracionBancoService } from './configuracion-banco.service';
import { ConfiguracionController } from './configuracion.controller';
import { ConfiguracionService } from './configuracion.service';

@Module({
  imports: [TypeOrmModule.forFeature([ConfiguracionMarca, CuentaDeposito])],
  controllers: [ConfiguracionController, ConfiguracionBancoController],
  providers: [ConfiguracionService, ConfiguracionBancoService],
  exports: [ConfiguracionService],
})
export class ConfiguracionModule {}
