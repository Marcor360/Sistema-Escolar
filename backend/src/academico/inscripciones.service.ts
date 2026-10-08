import { BitacoraAcademica } from '../entities/bitacora-academica.entity';
import { exigirGrupoConfigurable } from '../common/contexto-academico';
import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Grupo } from '../entities/grupo.entity';
import { Inscripcion } from '../entities/inscripcion.entity';
import { Alumno } from '../entities/alumno.entity';
import { JwtUser } from '../common/current-user.decorator';
import { ScopeService } from '../planteles/scope.service';
import { ListarGruposDto } from './academico.dto';
import { GruposService } from './grupos.service';
import { esConflictoUnico, esConflictoTransaccional } from './conflictos';
@Injectable()
export class InscripcionesService {
 constructor(@InjectRepository(Grupo) private readonly grupos: Repository<Grupo>,
@InjectRepository(Inscripcion) private readonly inscripciones: Repository<Inscripcion>,
private readonly scope: ScopeService,
private readonly dataSource: DataSource,
private readonly gruposService: GruposService) {}
async inscribirAlumno(grupoId: number, alumnoId: number, user: JwtUser) {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const grupo = await manager.getRepository(Grupo).findOne({
          where: { id: grupoId }, lock: { mode: 'pessimistic_write' },
        });
        if (!grupo) throw new NotFoundException('Grupo no encontrado');
        await this.scope.validarGestion(user, grupo.plantelId);
        if (!grupo.activo) throw new ConflictException('No se puede inscribir en un grupo inactivo');
        const alumno = await manager.getRepository(Alumno).findOne({ where: { id: alumnoId }, lock: { mode: 'pessimistic_write' } });
        if (!alumno) throw new NotFoundException('Alumno no encontrado');
        if (alumno.estatus !== 'ACTIVO') throw new ConflictException('El alumno no está activo');
        exigirGrupoConfigurable(grupo);
        if (!alumno.usuario.activo) throw new ConflictException('La cuenta del alumno no está activa');
        if (alumno.plantelId !== grupo.plantelId) {
          throw new ForbiddenException('El alumno no pertenece al plantel del grupo');
        }
        const inscripciones = manager.getRepository(Inscripcion);
        const otra = await inscripciones.findOne({ where: { alumnoId, estatus: 'ACTIVA', grupo: { cicloId: grupo.cicloId } } });
        if (otra) throw new ConflictException('El alumno ya tiene una inscripción activa en este ciclo; corrige la inscripción anterior');
        const duplicada = await inscripciones.findOne({ where: { grupoId, alumnoId } });
        if (duplicada) {
          duplicada.estatus = 'ACTIVA';
          const guardada = await inscripciones.save(duplicada);
          await manager.getRepository(BitacoraAcademica).insert({ usuarioId: user.sub, plantelId: grupo.plantelId, accion: 'INSCRIPCION_REACTIVADA', entidadId: guardada.id, detalle: `alumnoId=${alumnoId}; grupoId=${grupoId}`, fecha: new Date() });
          return guardada;
        }
        const guardada = await inscripciones.save(inscripciones.create({ grupoId, alumnoId }));
        await manager.getRepository(BitacoraAcademica).insert({ usuarioId: user.sub, plantelId: grupo.plantelId, accion: 'INSCRIPCION_CREADA', entidadId: guardada.id, detalle: `alumnoId=${alumnoId}; grupoId=${grupoId}`, fecha: new Date() });
        return guardada;
      });
    } catch (error) {
      if (esConflictoUnico(error) || esConflictoTransaccional(error)) throw new ConflictException('La inscripción cambió al mismo tiempo; vuelve a consultar');
      throw error;
    }
  }

async alumnosDeGrupo(grupoId: number, user: JwtUser) {
    await this.gruposService.validarAccesoGrupo(grupoId, user);
    const inscripciones = await this.inscripciones.find({ where: { grupoId, estatus: 'ACTIVA' } });
    return inscripciones.map((inscripcion) => ({
      id: inscripcion.id,
      alumnoId: inscripcion.alumnoId,
      grupoId: inscripcion.grupoId,
      estatus: inscripcion.estatus,
      fechaInscripcion: inscripcion.fechaInscripcion,
      alumno: {
        id: inscripcion.alumno.id,
        matricula: inscripcion.alumno.matricula,
        estatus: inscripcion.alumno.estatus,
        usuario: {
          nombre: inscripcion.alumno.usuario.nombre,
          apellidoPaterno: inscripcion.alumno.usuario.apellidoPaterno,
        },
      },
    }));
  }

async bajaInscripcion(id: number, user: JwtUser) {
    const inscripcion = await this.inscripciones.findOne({ where: { id } });
    if (!inscripcion) throw new NotFoundException('Inscripción no encontrada');
    await this.gruposService.validarAccesoGrupo(inscripcion.grupoId, user);
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Inscripcion);
      const actual = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!actual) throw new NotFoundException('Inscripción no encontrada');
      await this.scope.validarGestion(user, actual.grupo.plantelId);
      await repo.update(id, { estatus: 'BAJA' });
      await manager.getRepository(BitacoraAcademica).insert({ usuarioId: user.sub, plantelId: actual.grupo.plantelId, accion: 'INSCRIPCION_BAJA', entidadId: id, detalle: `alumnoId=${actual.alumnoId}; grupoId=${actual.grupoId}`, fecha: new Date() });
      return { ok: true };
    });
  }

async bitacoraAcademica(user: JwtUser, query: ListarGruposDto) {
    const planteles = await this.scope.resolverFiltro(user, query.plantelId);
    const [datos, total] = await this.dataSource.getRepository(BitacoraAcademica).findAndCount({ where: planteles === null ? {} : { plantelId: In(planteles) }, order: { id: 'DESC' }, skip: (query.pagina - 1) * query.porPagina, take: query.porPagina });
    return { datos, total, pagina: query.pagina, porPagina: query.porPagina };
  }
}
