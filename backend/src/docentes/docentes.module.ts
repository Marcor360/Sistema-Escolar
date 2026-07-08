import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Docente } from '../entities/docente.entity';
import { DocentesService } from './docentes.service';
import { DocentesController } from './docentes.controller';
import { UsuariosModule } from '../usuarios/usuarios.module';

@Module({
  imports: [TypeOrmModule.forFeature([Docente]), UsuariosModule],
  providers: [DocentesService],
  controllers: [DocentesController],
  exports: [DocentesService],
})
export class DocentesModule {}
