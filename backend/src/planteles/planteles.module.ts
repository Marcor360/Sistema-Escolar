import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Plantel } from '../entities/plantel.entity';
import { UsuarioPlantel } from '../entities/usuario-plantel.entity';
import { PlantelesController } from './planteles.controller';
import { PlantelesService } from './planteles.service';
import { ScopeService } from './scope.service';

@Module({
  imports: [TypeOrmModule.forFeature([Plantel, UsuarioPlantel])],
  providers: [PlantelesService, ScopeService],
  controllers: [PlantelesController],
  exports: [PlantelesService, ScopeService],
})
export class PlantelesModule {}
