import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfiguracionMarca } from '../entities';
import { ConfiguracionController } from './configuracion.controller';
import { ConfiguracionService } from './configuracion.service';

@Module({
  imports: [TypeOrmModule.forFeature([ConfiguracionMarca])],
  controllers: [ConfiguracionController],
  providers: [ConfiguracionService],
})
export class ConfiguracionModule {}
