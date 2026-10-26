import { readFile } from 'fs/promises';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource, MoreThan } from 'typeorm';
import { Actividad, Alumno, Cargo, Docente, Entrega, Grupo, Inscripcion, Sesion, Usuario } from '../entities';
import { MovimientoBancario } from '../entities/movimiento-bancario.entity';
import { Asistencia } from '../entities/asistencia.entity';
import { Tramite } from '../entities/tramite.entity';
import { PreferenciaNotificacion } from '../entities/preferencia-notificacion.entity';
import { ScopeService } from '../planteles/scope.service';
import { JwtUser } from '../common/current-user.decorator';
import { PreferenciasDto } from './seguimiento.dto';
@Injectable()
export class SeguimientoService {
  constructor(
    private readonly ds: DataSource,
    private readonly scope: ScopeService,
    private readonly config: ConfigService,
  ) {}
  async respaldo() {
    const ruta = this.config.get<string>('BACKUP_STATUS_PATH');
    if (!ruta) return { estado: 'SIN_CONFIGURAR', vencido: true, ultimoExito: null };
    try {
      const texto = await readFile(ruta, 'utf8');
      if (texto.length > 8192) throw new Error();
      const s = JSON.parse(texto.replace(/^\uFEFF/, ''));
      const fecha = typeof s.ultimoExito === 'string' ? Date.parse(s.ultimoExito) : NaN;
      return {
        estado: ['OK', 'ERROR', 'EN_CURSO'].includes(s.estado) ? s.estado : 'DESCONOCIDO',
        ultimoExito: Number.isFinite(fecha) ? new Date(fecha).toISOString() : null,
        vencido: !Number.isFinite(fecha) || Date.now() - fecha > 36 * 3600000,
      };
    } catch {
      return { estado: 'NO_DISPONIBLE', vencido: true, ultimoExito: null };
    }
  }
  async pendientes(u: JwtUser) {
    const tarjetas: { titulo: string; cantidad: number; ruta: string }[] = [];
    const alumno = u.roles.includes('ALUMNO')
      ? await this.ds.getRepository(Alumno).findOneBy({ usuarioId: u.sub })
      : null;
    if (alumno) {
      const mes=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Mexico_City'}).format(new Date()).slice(0,7)+'-01';
      const faltas=await this.ds.getRepository(Asistencia).createQueryBuilder('a').where('a.alumno_id=:id AND a.estado=:estado AND a.fecha>=:mes',{id:alumno.id,estado:'FALTA',mes}).getCount();
      tarjetas.push({titulo:'Faltas registradas este mes',cantidad:faltas,ruta:'/asistencias'});
      const tareas = await this.ds
        .getRepository(Actividad)
        .createQueryBuilder('a')
        .innerJoin('a.grupoMateria', 'gm')
        .innerJoin(Inscripcion, 'i', 'i.grupo_id=gm.grupo_id AND i.alumno_id=:alumno AND i.estatus=:estatus', {
          alumno: alumno.id,
          estatus: 'ACTIVA',
        })
        .leftJoin(Entrega, 'e', 'e.actividad_id=a.id AND e.alumno_id=:alumno', { alumno: alumno.id })
        .where('a.activo=:activo AND e.id IS NULL', { activo: true })
        .getCount();
      tarjetas.push({ titulo: 'Actividades sin entrega', cantidad: tareas, ruta: '/' });
    }
    const personal = u.roles.some((r) => ['ADMINISTRATIVO', 'SUPERADMIN'].includes(r));
    const fin = u.roles.some((r) => ['FINANZAS', 'SUPERADMIN'].includes(r));
    const planteles = !alumno && (personal || fin) ? await this.scope.resolverFiltro(u) : null;
    if(fin){const banco=this.ds.getRepository(MovimientoBancario).createQueryBuilder('m').where('m.estado<>:estado',{estado:'APLICADO'});if(planteles)banco.andWhere('m.plantel_id IN (:...planteles)',{planteles});tarjetas.push({titulo:'Movimientos por conciliar',cantidad:await banco.getCount(),ruta:'/seguimiento'});}
    if (alumno || fin) {
      const qb = this.ds
        .getRepository(Cargo)
        .createQueryBuilder('c')
        .where('c.estatus IN (:...estados)', { estados: ['PENDIENTE', 'PARCIAL', 'VENCIDO'] });
      if (alumno) qb.andWhere('c.alumno_id=:id', { id: alumno.id });
      else if (planteles) qb.andWhere('c.plantel_id IN (:...planteles)', { planteles });
      tarjetas.push({
        titulo: alumno ? 'Cargos por cubrir' : 'Cargos pendientes de cobro',
        cantidad: await qb.getCount(),
        ruta: alumno ? '/' : '/finanzas?vista=cargos',
      });
    }
    if (u.roles.includes('MAESTRO')) {
      const d = await this.ds.getRepository(Docente).findOneBy({ usuarioId: u.sub });
      if (d)
        tarjetas.push({
          titulo: 'Entregas sin calificar',
          cantidad: await this.ds
            .getRepository(Entrega)
            .createQueryBuilder('e')
            .innerJoin('e.actividad', 'a')
            .innerJoin('a.grupoMateria', 'gm')
            .where('gm.docente_id=:d AND e.calificacion IS NULL', { d: d.id })
            .getCount(),
          ruta: '/maestro?vista=consulta',
        });
    }
    if (personal || alumno) {
      const qb = this.ds
        .getRepository(Tramite)
        .createQueryBuilder('t')
        .where('t.estado IN (:...estados)', { estados: ['SOLICITADO', 'EN_REVISION'] });
      if (alumno) qb.andWhere('t.alumno_id=:id', { id: alumno.id });
      else if (planteles) qb.andWhere('t.plantel_id IN (:...planteles)', { planteles });
      tarjetas.push({ titulo: 'Trámites abiertos', cantidad: await qb.getCount(), ruta: '/seguimiento' });
    }
    if (personal)
      tarjetas.push({
        titulo: 'Grupos activos sin nivel',
        cantidad: await this.gruposSinNivel(u).getCount(),
        ruta: '/seguimiento',
      });
    return tarjetas;
  }
  private gruposSinNivel(u: JwtUser) {
    const qb = this.ds
      .getRepository(Grupo)
      .createQueryBuilder('g')
      .where('g.activo=:activo AND g.nivel_id IS NULL', { activo: true });
    if (!u.roles.includes('SUPERADMIN'))
      qb.andWhere(
        'g.plantel_id IN (SELECT up.plantel_id FROM usuario_planteles up WHERE up.usuario_id=:sub AND up.activo=:activo)',
        { sub: u.sub, activo: true },
      );
    return qb;
  }
  async calidad(u: JwtUser) {
    const planteles = await this.scope.resolverFiltro(u);
    const qb = this.ds
      .getRepository(Alumno)
      .createQueryBuilder('a')
      .innerJoin('a.usuario', 'u')
      .where('a.estatus=:estatus', { estatus: 'ACTIVO' });
    if (planteles) qb.andWhere('a.plantel_id IN (:...planteles)', { planteles });
    const incompletos = await qb
      .clone()
      .andWhere("(a.curp IS NULL OR a.curp='' OR u.telefono IS NULL OR u.telefono='')")
      .select(['a.id', 'a.matricula'])
      .take(100)
      .getMany();
    const duplicados = await qb
      .clone()
      .andWhere("a.curp IS NOT NULL AND a.curp<>''")
      .select('a.curp', 'curp')
      .addSelect('COUNT(a.id)', 'cantidad')
      .groupBy('a.curp')
      .having('COUNT(a.id)>1')
      .limit(100)
      .getRawMany();
    const inscripciones=this.ds.getRepository(Inscripcion).createQueryBuilder('i').innerJoin('i.alumno','a').innerJoin('i.grupo','g').innerJoin('g.ciclo','c').where('i.estatus=:estatus AND g.activo=:activo AND c.activo=:activo AND a.plantel_id<>g.plantel_id',{estatus:'ACTIVA',activo:true});
    if(planteles)inscripciones.andWhere('a.plantel_id IN (:...planteles)',{planteles});
    return {
      inscripcionesInconsistentes:await inscripciones.select(['i.id','i.alumnoId','i.grupoId']).take(100).getMany(),
      incompletos,
      duplicados,
      gruposSinNivel: await this.gruposSinNivel(u).select(['g.id', 'g.nombre', 'g.plantelId']).take(100).getMany(),
      limite: 100,
    };
  }
  async preferencias(u: JwtUser) {
    const filas = await this.ds.getRepository(PreferenciaNotificacion).findBy({ usuarioId: u.sub });
    return (['GENERAL', 'ACADEMICA', 'FINANCIERA'] as const).map((tipo) => ({
      tipo,
      push: filas.find((f) => f.tipo === tipo)?.push ?? true,
      correo: filas.find((f) => f.tipo === tipo)?.correo ?? true,
    }));
  }
  async guardarPreferencias(dto: PreferenciasDto, u: JwtUser) {
    if (new Set(dto.preferencias.map((p) => p.tipo)).size !== dto.preferencias.length)
      throw new BadRequestException('Categorías repetidas');
    await this.ds.transaction(async (m) => {
      // Una fila estable del usuario serializa altas y cambios simultáneos de preferencias.
      await m.getRepository(Usuario).findOne({ where: { id: u.sub }, lock: { mode: 'pessimistic_write' } });
      const repo = m.getRepository(PreferenciaNotificacion);
      for (const p of dto.preferencias) {
        const anterior = await repo.findOneBy({ usuarioId: u.sub, tipo: p.tipo });
        await repo.save({ ...anterior, ...p, usuarioId: u.sub });
      }
    });
    return this.preferencias(u);
  }
  async sesiones(u: JwtUser) {
    return (
      await this.ds
        .getRepository(Sesion)
        .find({
          where: { usuarioId: u.sub, revocada: false, expiraEn: MoreThan(new Date()), ultimaActividadEn: MoreThan(new Date(Date.now()-30*60000)), ...(u.ver===undefined?{}:{version:u.ver}) },
          order: { ultimaActividadEn: 'DESC' },
          take: 100,
        })
    ).map((s) => ({
      id: s.id,
      portal: s.portal,
      dispositivo:s.dispositivo,
      ultimaActividadEn: s.ultimaActividadEn,
      expiraEn: s.expiraEn,
      actual: s.id === u.sid,
    }));
  }
  async revocarSesion(id: string, u: JwtUser) {
    if (id === u.sid) throw new BadRequestException('Usa Cerrar sesión para salir del dispositivo actual');
    await this.ds.getRepository(Sesion).update({ id, usuarioId: u.sub }, { revocada: true });
    return { ok: true };
  }
}
