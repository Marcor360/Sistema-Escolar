import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { EntityManager } from 'typeorm';
import { Alumno, BitacoraAcademica, CicloEscolar, Grupo, Inscripcion, Plantel, SolicitudGrupoRegular } from '../entities';
import { JwtUser } from '../common/current-user.decorator';
import { ScopeService } from '../planteles/scope.service';
import { validarContextoGrupo } from '../catalogos-academicos/contexto-grupo';
import { planificarGruposRegulares } from './distribucion-grupos';
export interface ContextoRegular { alumnoId: number; plantelId: number; cicloId: number; nivelId: number; carreraId: number; periodoAcademicoId: number; turno: 'MATUTINO' | 'VESPERTINO'; grupoId?: number }
/** Coordinador interno exclusivo de apertura ordinaria. El llamador comparte
 * transacción READ COMMITTED con los cargos; nunca procesa especiales/recursantes. */
@Injectable()
export class AgrupacionRegularService {
  constructor(private readonly scope: ScopeService) {}
  async solicitar(m: EntityManager, d: ContextoRegular, u: JwtUser) {
    if (!u.roles.some(r => ['SUPERADMIN','ADMINISTRATIVO'].includes(r))) throw new ForbiddenException('Apertura reservada a Control Escolar');
    await this.scope.validarGestion(u, d.plantelId);
    const plantel = await m.getRepository(Plantel).findOne({ where: { id: d.plantelId }, lock: { mode: 'pessimistic_write' } });
    const ciclo = await m.getRepository(CicloEscolar).findOneBy({ id: d.cicloId });
    if (!plantel?.activo || !ciclo || !['ACTIVO','PREPARACION'].includes(ciclo.estado)) throw new ConflictException('Plantel y ciclo no disponibles');
    await validarContextoGrupo(m, d);
    const alumno = await m.getRepository(Alumno).findOne({ where: { id: d.alumnoId }, lock: { mode: 'pessimistic_write' } });
    if (!alumno || alumno.plantelId !== d.plantelId) throw new ForbiddenException('Alumno fuera del plantel');
    if (alumno.estatus !== 'ACTIVO' || !alumno.usuario.activo) throw new ConflictException('Alumno inactivo');
    const solicitudes = m.getRepository(SolicitudGrupoRegular);
    const previa = await solicitudes.findOneBy({ alumnoId: d.alumnoId, cicloId: d.cicloId });
    if (previa) throw new ConflictException('Ya existe una solicitud ordinaria del alumno en el ciclo; consulta su apertura original');
    const inscripciones = m.getRepository(Inscripcion);
    const activa = await inscripciones.findOne({ where: { alumnoId: d.alumnoId, estatus: 'ACTIVA', grupo: { cicloId: d.cicloId, tipo: 'REGULAR' } } });
    const contexto = { plantelId: d.plantelId, cicloId: d.cicloId, nivelId: d.nivelId, carreraId: d.carreraId, periodoAcademicoId: d.periodoAcademicoId, turno: d.turno };
    const grupos = m.getRepository(Grupo);
    const compatibles = await grupos.find({ where: { ...contexto, tipo: 'REGULAR', activo: true }, order: { id: 'ASC' }, lock: { mode: 'pessimistic_write' } });
    if (activa && (!d.grupoId || activa.grupoId !== d.grupoId || !compatibles.some(g => g.id === d.grupoId))) throw new ConflictException('El alumno ya tiene grupo regular; selecciona ese mismo grupo compatible sin trasladarlo');
    if (d.grupoId && !compatibles.some(g => g.id === d.grupoId)) throw new ConflictException('El grupo seleccionado no es regular compatible');
    const solicitud = await solicitudes.save(solicitudes.create({ ...contexto, alumnoId: d.alumnoId, grupoId: null, estado: 'PENDIENTE' }));
    const asignadas: number[] = [];
    const asignar = async (s: SolicitudGrupoRegular, g: Grupo) => {
      const otra = await inscripciones.findOne({ where: { alumnoId: s.alumnoId, estatus: 'ACTIVA', grupo: { cicloId: s.cicloId, tipo: 'REGULAR' } } });
      if (otra && otra.grupoId !== g.id) throw new ConflictException('La inscripción regular cambió; no se trasladan alumnos automáticamente');
      const anterior = await inscripciones.findOneBy({ alumnoId: s.alumnoId, grupoId: g.id });
      if (!otra) await inscripciones.save(anterior ? { ...anterior, estatus: 'ACTIVA' } : inscripciones.create({ alumnoId: s.alumnoId, grupoId: g.id, estatus: 'ACTIVA' }));
      await solicitudes.update(s.id, { estado: 'ASIGNADA', grupoId: g.id });
      await m.getRepository(BitacoraAcademica).insert({ usuarioId: u.sub, plantelId: s.plantelId, accion: 'AGRUPACION_ORDINARIA', entidadId: s.id, detalle: `alumnoId=${s.alumnoId}; grupoId=${g.id}; apertura ordinaria`, fecha: new Date() });
      asignadas.push(s.id);
    };
    if (d.grupoId) {
      const g = compatibles.find(g => g.id === d.grupoId)!;
      const total = await inscripciones.countBy({ grupoId: g.id, estatus: 'ACTIVA' });
      if (!activa && total >= 50) throw new ConflictException('Grupo seleccionado completo; usa planificación automática o resolución administrativa');
      await asignar(solicitud, g);
    } else {
      const pendientes = await solicitudes.find({ where: { ...contexto, estado: 'PENDIENTE' }, relations: { alumno: { usuario: true } }, order: { id: 'ASC' } });
      const validas: SolicitudGrupoRegular[] = [];
      for (const s of pendientes) {
        if (s.alumno.plantelId !== s.plantelId || s.alumno.estatus !== 'ACTIVO' || !s.alumno.usuario.activo) {
          await solicitudes.update(s.id, { estado: 'ANULADA' });
          await m.getRepository(BitacoraAcademica).insert({ usuarioId: u.sub, plantelId: s.plantelId, accion: 'SOLICITUD_ORDINARIA_ANULADA', entidadId: s.id, detalle: 'Alumno inactivo o trasladado antes de agrupación', fecha: new Date() });
        } else validas.push(s);
      }
      for (const g of compatibles) {
        let total = await inscripciones.countBy({ grupoId: g.id, estatus: 'ACTIVA' });
        while (validas.length && total < 50) { await asignar(validas.shift()!, g); total++; }
      }
      const plan = planificarGruposRegulares(validas.length);
      for (const cantidad of plan.grupos) {
        const g = await grupos.save(grupos.create({ ...contexto, nombre: `AUTO-${d.periodoAcademicoId}-${randomUUID().slice(0, 8)}`, tipo: 'REGULAR', programaEspecialId: null, cupoManual: null, activo: true }));
        for (let n = 0; n < cantidad; n++) await asignar(validas.shift()!, g);
      }
      // Solo el remanente de 1–4 puede usar la excepción; nunca se toca historial.
      for (const g of compatibles) {
        let total = await inscripciones.countBy({ grupoId: g.id, estatus: 'ACTIVA' });
        while (validas.length && total >= 50 && total < 54) { await asignar(validas.shift()!, g); total++; }
      }
    }
    return { solicitud: await solicitudes.findOneByOrFail({ id: solicitud.id }), asignadas };
  }
}
