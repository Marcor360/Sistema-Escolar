import { PromocionService } from './promocion.service';
import { CiclosService } from './ciclos.service';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CicloEscolar } from '../entities/ciclo-escolar.entity';
import { Materia } from '../entities/materia.entity';
import { Grupo } from '../entities/grupo.entity';
import { GrupoMateria } from '../entities/grupo-materia.entity';
import { Inscripcion } from '../entities/inscripcion.entity';
import { Alumno } from '../entities/alumno.entity';
import { Calificacion } from '../entities/calificacion.entity';
import { Actividad } from '../entities/actividad.entity';
import { Material } from '../entities/material.entity';
import { UsuarioPlantel } from '../entities/usuario-plantel.entity';
import { AcademicoService } from './academico.service';
import { AcademicoController } from './academico.controller';
import { DocentesModule } from '../docentes/docentes.module';
import { PlantelesModule } from '../planteles/planteles.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CicloEscolar, Materia, Grupo, GrupoMateria, Inscripcion, Alumno, Calificacion, Actividad, Material,
      UsuarioPlantel,
    ]),
    DocentesModule,
    PlantelesModule,
  ],
  providers: [AcademicoService, CiclosService, PromocionService],
  controllers: [AcademicoController],
  exports: [AcademicoService],
})
export class AcademicoModule {}
