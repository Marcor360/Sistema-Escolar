import { CicloFichaService } from './ciclo-ficha.service';
import { MateriaContextosController } from './materia-contextos.controller';
import { MateriaContextosService } from './materia-contextos.service';
import { AgrupacionRegularService } from './agrupacion-regular.service';
import { ProgramasEspecialesController } from '../programas-especiales/programas.controller';
import { ProgramasEspecialesService } from '../programas-especiales/programas.service';
import { CatalogosAcademicosController } from '../catalogos-academicos/catalogos.controller';
import { CatalogosAcademicosService } from '../catalogos-academicos/catalogos.service';
import { MateriasService } from './materias.service';
import { GruposService } from './grupos.service';
import { InscripcionesService } from './inscripciones.service';
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
  providers: [CicloFichaService, MateriaContextosService, AgrupacionRegularService, ProgramasEspecialesService, CatalogosAcademicosService, AcademicoService, CiclosService, PromocionService, MateriasService, GruposService, InscripcionesService],
  controllers: [MateriaContextosController, ProgramasEspecialesController, CatalogosAcademicosController, AcademicoController],
  exports: [AcademicoService, AgrupacionRegularService],
})
export class AcademicoModule {}
