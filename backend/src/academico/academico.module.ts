import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CicloEscolar } from '../entities/ciclo-escolar.entity';
import { Materia } from '../entities/materia.entity';
import { Grupo } from '../entities/grupo.entity';
import { GrupoMateria } from '../entities/grupo-materia.entity';
import { Inscripcion } from '../entities/inscripcion.entity';
import { Alumno } from '../entities/alumno.entity';
import { AcademicoService } from './academico.service';
import { AcademicoController } from './academico.controller';
import { DocentesModule } from '../docentes/docentes.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CicloEscolar, Materia, Grupo, GrupoMateria, Inscripcion, Alumno]),
    DocentesModule,
  ],
  providers: [AcademicoService],
  controllers: [AcademicoController],
  exports: [AcademicoService],
})
export class AcademicoModule {}
