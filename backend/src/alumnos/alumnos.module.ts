import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Alumno } from '../entities/alumno.entity';
import { Inscripcion } from '../entities/inscripcion.entity';
import { GrupoMateria } from '../entities/grupo-materia.entity';
import { AlumnosService } from './alumnos.service';
import { AlumnosController } from './alumnos.controller';
import { UsuariosModule } from '../usuarios/usuarios.module';

@Module({
  imports: [TypeOrmModule.forFeature([Alumno, Inscripcion, GrupoMateria]), UsuariosModule],
  providers: [AlumnosService],
  controllers: [AlumnosController],
  exports: [AlumnosService],
})
export class AlumnosModule {}
