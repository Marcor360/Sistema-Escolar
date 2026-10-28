import { ParticipacionAsignatura } from '../entities/participacion-asignatura.entity';
import { limiteRegulares } from '../recursamientos/acceso-recursamiento';
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
async inscribirAlumno(grupoId: number, alumnoId: number, user: JwtUser, correccion?: {motivo?:string;documentoRef?:string}) {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const grupo = await manager.getRepository(Grupo).findOne({
          where: { id: grupoId }, lock: { mode: 'pessimistic_write' },
        });
        if (!grupo) throw new NotFoundException('Grupo no encontrado');
        await this.scope.validarGestion(user, grupo.plantelId);
        if (grupo.tipo === 'ESPECIAL') throw new ConflictException('Usa la inscripción manual de programas especiales');
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
        const otra = await inscripciones.findOne({ where: { alumnoId, estatus: 'ACTIVA', grupo: { cicloId: grupo.cicloId, tipo: 'REGULAR' } } });
        if (otra) throw new ConflictException('El alumno ya tiene una inscripción activa en este ciclo; corrige la inscripción anterior');
        // La inscripción directa no utiliza la excepción de remanente (51–54), reservada a cartera.
        const limite = Math.min(50, await limiteRegulares(manager, grupoId));
        if (await inscripciones.countBy({ grupoId, estatus: 'ACTIVA' }) >= limite) {
          throw new ConflictException('El grupo alcanzó el cupo de inscripción directa; revisa la apertura de cartera y las reservas por recursamiento');
        }
        const duplicada = await inscripciones.findOne({ where: { grupoId, alumnoId } });
        if (!duplicada || duplicada.estatus !== 'BAJA') throw new ConflictException('Las altas ordinarias requieren Apertura de cartera; usa Reinscribir alumno para cambiar de periodo. Esta ruta solo reactiva una inscripción previa en baja del mismo grupo');
        if (!correccion?.motivo?.trim() || correccion.motivo.trim().length<10 || !correccion.documentoRef?.trim() || correccion.documentoRef.trim().length<5) throw new ConflictException('La reactivación exige motivo detallado y referencia documental; no genera cargos retroactivos');
        if (duplicada) {
          duplicada.estatus = 'ACTIVA';
          const guardada = await inscripciones.save(duplicada);
          await manager.getRepository(BitacoraAcademica).insert({ usuarioId: user.sub, plantelId: grupo.plantelId, accion: 'INSCRIPCION_REACTIVADA', entidadId: guardada.id, detalle: `alumnoId=${alumnoId}; grupoId=${grupoId}; motivo=${correccion.motivo}; documento=${correccion.documentoRef}`.slice(0,500), fecha: new Date() });
          return guardada;
        }
        throw new ConflictException('La inscripción requiere apertura de cartera');
      });
    } catch (error) {
      if (esConflictoUnico(error) || esConflictoTransaccional(error)) throw new ConflictException('La inscripción cambió al mismo tiempo; vuelve a consultar');
      throw error;
    }
  }

async alumnosDeGrupo(grupoId: number, user: JwtUser, incluirHistoricas=false) {
    await this.gruposService.validarAccesoGrupo(grupoId, user);
    const inscripciones = await this.inscripciones.find({ where: { grupoId, estatus: incluirHistoricas ? In(['ACTIVA','HISTORICA']) : 'ACTIVA' } });
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
    if (inscripcion.grupo.tipo === 'ESPECIAL') throw new ConflictException('Usa la baja con motivo de programas especiales');
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Inscripcion);
      const actual = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!actual) throw new NotFoundException('Inscripción no encontrada');
      await this.scope.validarGestion(user, actual.grupo.plantelId);
      if(actual.estatus==='HISTORICA')throw new ConflictException('La inscripción pertenece al historial de otro periodo; no se convierte en baja ni se elimina');
      await repo.update(id, { estatus: 'BAJA' });
      await manager.getRepository(ParticipacionAsignatura).update({ inscripcionPrincipalId: id, estado: 'ACTIVA' }, { estado: 'BAJA', activoClave: null });
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
