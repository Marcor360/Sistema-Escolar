import { Module } from '@nestjs/common';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { PlantelesModule } from '../planteles/planteles.module';
import { ImportacionesController } from './importaciones.controller';
import { ImportacionesService } from './importaciones.service';
@Module({ imports: [UsuariosModule, PlantelesModule], controllers: [ImportacionesController], providers: [ImportacionesService] })
export class ImportacionesModule {}
