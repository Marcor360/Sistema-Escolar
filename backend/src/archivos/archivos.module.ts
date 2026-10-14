import { BibliotecaService } from '../biblioteca/biblioteca.service';
import { BibliotecaController } from '../biblioteca/biblioteca.controller';
import { ArchivoLimpiezaService } from './archivo-limpieza.service';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Material } from '../entities/material.entity';
import { Entrega } from '../entities/entrega.entity';
import { Inscripcion } from '../entities/inscripcion.entity';
import { Usuario } from '../entities/usuario.entity';
import { ArchivosService } from './archivos.service';
import { ArchivosController } from './archivos.controller';
import { PlantelesModule } from '../planteles/planteles.module';
import { LogoPublicoController } from './logo-publico.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Material, Entrega, Inscripcion, Usuario]),
    PlantelesModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || 'cambiar-en-produccion',
      }),
    }),
  ],
  exports: [ArchivosService],
  providers: [ArchivosService, ArchivoLimpiezaService, BibliotecaService],
  controllers: [ArchivosController, LogoPublicoController, BibliotecaController],
})
export class ArchivosModule {}
