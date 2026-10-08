import { Injectable } from '@nestjs/common';
import { JwtUser } from '../common/current-user.decorator';
import { ActualizarCicloDto, ActualizarGrupoDto, ActualizarMateriaDto, AsignarMateriaDto, CicloDto, GrupoDto, ListarGruposDto, MateriaDto } from './academico.dto';
import { CiclosService } from './ciclos.service';
import { MateriasService } from './materias.service';
import { GruposService } from './grupos.service';
import { InscripcionesService } from './inscripciones.service';
@Injectable()
export class AcademicoService {
 constructor(private readonly ciclos: CiclosService, private readonly materias: MateriasService, private readonly grupos: GruposService, private readonly inscripciones: InscripcionesService) {}
listarCiclos() { return this.ciclos.listarCiclos(); }
async crearCiclo(dto: CicloDto) { return this.ciclos.crearCiclo(dto); }
async actualizarCiclo(id: number, dto: ActualizarCicloDto) { return this.ciclos.actualizarCiclo(id, dto); }
listarMaterias() { return this.materias.listarMaterias(); }
crearMateria(dto: MateriaDto) { return this.materias.crearMateria(dto); }
async actualizarMateria(id: number, dto: ActualizarMateriaDto) { return this.materias.actualizarMateria(id, dto); }
async desactivarMateria(id: number) { return this.materias.desactivarMateria(id); }
async listarGrupos(user: JwtUser, query: ListarGruposDto) { return this.grupos.listarGrupos(user, query); }
async crearGrupo(dto: GrupoDto, user: JwtUser) { return this.grupos.crearGrupo(dto, user); }
async actualizarGrupo(id: number, dto: ActualizarGrupoDto, user: JwtUser) { return this.grupos.actualizarGrupo(id, dto, user); }
async eliminarGrupo(id: number, user: JwtUser) { return this.grupos.eliminarGrupo(id, user); }
async listarGrupoMaterias(user: JwtUser) { return this.grupos.listarGrupoMaterias(user); }
async materiasDeGrupo(grupoId: number, user: JwtUser) { return this.grupos.materiasDeGrupo(grupoId, user); }
async asignarMateria(grupoId: number, dto: AsignarMateriaDto, user: JwtUser) { return this.grupos.asignarMateria(grupoId, dto, user); }
async asignarDocente(grupoMateriaId: number, docenteId: number, user: JwtUser) { return this.grupos.asignarDocente(grupoMateriaId, docenteId, user); }
async eliminarGrupoMateria(id: number, user: JwtUser) { return this.grupos.eliminarGrupoMateria(id, user); }
async inscribirAlumno(grupoId: number, alumnoId: number, user: JwtUser) { return this.inscripciones.inscribirAlumno(grupoId, alumnoId, user); }
async alumnosDeGrupo(grupoId: number, user: JwtUser) { return this.inscripciones.alumnosDeGrupo(grupoId, user); }
async bajaInscripcion(id: number, user: JwtUser) { return this.inscripciones.bajaInscripcion(id, user); }
async bitacoraAcademica(user: JwtUser, query: ListarGruposDto) { return this.inscripciones.bitacoraAcademica(user, query); }
async misGrupos(usuarioId: number) { return this.grupos.misGrupos(usuarioId); }
}
