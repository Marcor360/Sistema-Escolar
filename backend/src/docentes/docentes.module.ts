import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Docente } from '../entities/docente.entity';
import { DocentesService } from './docentes.service';
import { DocentesController } from './docentes.controller';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { UsuarioPlantel } from '../entities/usuario-plantel.entity';
import { PlantelesModule } from '../planteles/planteles.module';

@Module({
  imports: [TypeOrmModule.forFeature([Docente, UsuarioPlantel]), UsuariosModule, PlantelesModule],
  providers: [DocentesService],
  controllers: [DocentesController],
  exports: [DocentesService],
})
export class DocentesModule {}
