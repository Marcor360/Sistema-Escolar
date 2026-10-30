import { ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Grupo, Inscripcion } from '../entities';
import { BoletaRespuesta } from '../entities/boleta-respuesta.entity';
import { BoletaAtencion } from '../entities/boleta-atencion.entity';
import { JwtUser } from '../common/current-user.decorator';
import { ScopeService } from '../planteles/scope.service';
import { ListarBoletasDto, FiltrosBoletaDto } from './boletas.dto';
import { versionesBoletas } from './lectura-boletas';
@Injectable()
export class BoletasBandejaService {
  constructor(
    private readonly ds: DataSource,
    private readonly scope: ScopeService,
  ) {}
  async filtros(q: FiltrosBoletaDto, u: JwtUser) {
    if (!u.roles.some((r) => ['SUPERADMIN', 'ADMINISTRATIVO', 'DIRECTOR', 'MAESTRO'].includes(r)))
      throw new ForbiddenException('Consulta exclusiva de personal académico');
    const qb = this.ds
      .getRepository(Grupo)
      .createQueryBuilder('g')
      .innerJoin('g.plantel', 'p')
      .innerJoin('g.ciclo', 'c');
    if (u.roles.some((r) => ['SUPERADMIN', 'ADMINISTRATIVO', 'DIRECTOR'].includes(r))) {
      const ids = await this.scope.resolverFiltro(u, q.plantelId);
      if (ids !== null) qb.where('g.plantel_id IN (:...ids)', { ids });
    } else {
      qb.where(
        "EXISTS (SELECT 1 FROM grupo_materias gm INNER JOIN docentes d ON d.id=gm.docente_id WHERE gm.grupo_id=g.id AND d.usuario_id=:actor AND d.estatus='ACTIVO')",
        { actor: u.sub },
      );
      if (q.plantelId) qb.andWhere('g.plantel_id=:plantel', { plantel: q.plantelId });
    }
    if (q.cicloId && q.tipo === 'grupo') qb.andWhere('g.ciclo_id=:ciclo', { ciclo: q.cicloId });
    const alias = q.tipo === 'plantel' ? 'p' : q.tipo === 'ciclo' ? 'c' : 'g';
    if (q.buscar)
      qb.andWhere(`LOWER(${alias}.nombre) LIKE :texto ESCAPE '!'`, {
        texto: '%' + q.buscar.toLowerCase().replace(/[!%_[]/g, (v) => '!' + v) + '%',
      });
    // Solo metadatos de los contextos autorizados; no datos de estudiantes.
    const rows = await qb
      .select(`${alias}.id`, 'id')
      .addSelect(`${alias}.nombre`, 'nombre')
      .distinct(true)
      .orderBy(`${alias}.nombre`, 'ASC')
      .getRawMany<{ id: number; nombre: string }>();
    return {
      datos: rows.slice((q.pagina - 1) * q.porPagina, q.pagina * q.porPagina),
      total: rows.length,
      pagina: q.pagina,
      porPagina: q.porPagina,
    };
  }
  async listar(q: ListarBoletasDto, u: JwtUser, alumno = false) {
    if (
      alumno
        ? !u.roles.includes('ALUMNO')
        : !u.roles.some((r) => ['SUPERADMIN', 'ADMINISTRATIVO', 'DIRECTOR', 'MAESTRO'].includes(r))
    )
      throw new ForbiddenException('Consulta fuera de tu alcance');
    const base = this.ds
      .getRepository(Inscripcion)
      .createQueryBuilder('i')
      .innerJoinAndSelect('i.alumno', 'a')
      .innerJoinAndSelect('a.usuario', 'usuario')
      .innerJoinAndSelect('i.grupo', 'g')
      .innerJoinAndSelect('g.ciclo', 'c')
      .where('1=1');
    if (alumno) base.andWhere('a.usuario_id=:actor', { actor: u.sub });
    else if (u.roles.some((r) => ['SUPERADMIN', 'ADMINISTRATIVO', 'DIRECTOR'].includes(r))) {
      const ids = await this.scope.resolverFiltro(u, q.plantelId);
      if (ids !== null) base.andWhere('g.plantel_id IN (:...ids)', { ids });
    } else {
      base.andWhere(
        "EXISTS (SELECT 1 FROM grupo_materias gm INNER JOIN docentes d ON d.id=gm.docente_id WHERE gm.grupo_id=i.grupo_id AND d.usuario_id=:actor AND d.estatus='ACTIVO')",
        { actor: u.sub },
      );
      if (q.plantelId) base.andWhere('g.plantel_id=:plantel', { plantel: q.plantelId });
    }
    if (q.grupoId) base.andWhere('i.grupo_id=:grupo', { grupo: q.grupoId });
    if (q.cicloId) base.andWhere('g.ciclo_id=:ciclo', { ciclo: q.cicloId });
    // Búsqueda literal portable: no aceptar comodines introducidos por el usuario.
    if (q.buscar)
      for (const [indice, palabra] of q.buscar.split(/\s+/).filter(Boolean).slice(0, 10).entries()) {
        const clave = `busqueda${indice}`,
          texto = '%' + palabra.replace(/[!%_[]/g, (v) => '!' + v).toLowerCase() + '%';
        base.andWhere(
          `(LOWER(usuario.nombre) LIKE :${clave} ESCAPE '!' OR LOWER(usuario.apellido_paterno) LIKE :${clave} ESCAPE '!' OR LOWER(usuario.apellido_materno) LIKE :${clave} ESCAPE '!' OR LOWER(a.matricula) LIKE :${clave} ESCAPE '!')`,
          { [clave]: texto },
        );
      }
    if (q.estado === 'ACEPTADA' || q.estado === 'REVISION')
      base.andWhere(
        "EXISTS (SELECT 1 FROM boleta_respuestas r WHERE r.inscripcion_id=i.id AND r.estado=:respuestaEstado AND NOT EXISTS (SELECT 1 FROM boleta_respuestas b WHERE b.inscripcion_id=i.id AND b.estado IN ('ACEPTADA','REVISION') AND b.id>r.id))",
        { respuestaEstado: q.estado },
      );
    if (q.estado === 'PENDIENTE_RESPUESTA')
      base.andWhere(
        "EXISTS (SELECT 1 FROM grupo_materias gm INNER JOIN periodos_calificacion pc ON pc.grupo_materia_id=gm.id WHERE gm.grupo_id=i.grupo_id AND pc.estatus='CERRADO')",
      );
    // Publicación/huella se derivan de notas vigentes. Recorrido acotado en memoria y paginación posterior para no perder pendientes por filtros derivados.
    let cursor = 0,
      total = 0;
    const datos = [];
    const desde = (q.pagina - 1) * q.porPagina;
    for (;;) {
      const inscripciones = await base
        .clone()
        .andWhere('i.id>:cursor', { cursor })
        .orderBy('i.id', 'ASC')
        .take(100)
        .getMany();
      if (!inscripciones.length) break;
      cursor = inscripciones[inscripciones.length - 1].id;
      const ids = inscripciones.map((i) => i.id),
        versiones = await versionesBoletas(this.ds.manager, inscripciones);
      const respuestas = await this.ds
        .getRepository(BoletaRespuesta)
        .createQueryBuilder('r')
        .where('r.inscripcion_id IN (:...ids)', { ids })
        .andWhere(
          "r.estado IN ('ACEPTADA','REVISION') AND NOT EXISTS (SELECT 1 FROM boleta_respuestas b WHERE b.inscripcion_id=r.inscripcion_id AND b.estado IN ('ACEPTADA','REVISION') AND b.id>r.id)",
        )
        .getMany();
      const revisiones = respuestas.filter((r) => r.estado === 'REVISION').map((r) => r.id);
      const atenciones = revisiones.length
        ? await this.ds
            .getRepository(BoletaAtencion)
            .createQueryBuilder('t')
            .leftJoinAndSelect('t.responsable', 'responsable')
            .where('t.respuesta_id IN (:...revisiones)', { revisiones })
            .andWhere(
              'NOT EXISTS (SELECT 1 FROM boleta_atenciones x WHERE x.respuesta_id=t.respuesta_id AND x.id>t.id)',
            )
            .getMany()
        : [];
      const porInscripcion = new Map(respuestas.map((r) => [r.inscripcionId, r]));
      const porRespuesta = new Map(atenciones.map((t) => [t.respuestaId, t]));
      for (const i of inscripciones) {
        const v = versiones.get(i.id)!,
          r = porInscripcion.get(i.id),
          vigente = !!r && v.disponible && r.versionHash === v.hash;
        if (!v.disponible && !r) continue;
        const pendiente = v.disponible && !vigente;
        const t = r ? porRespuesta.get(r.id) : undefined;
        const estadoAtencion = r?.estado === 'REVISION' ? (t?.estado ?? 'PENDIENTE') : null;
        if (q.estado === 'PENDIENTE_RESPUESTA' && !pendiente) continue;
        if (q.estado && q.estado !== 'PENDIENTE_RESPUESTA' && r?.estado !== q.estado) continue;
        if (q.atencion && (!vigente || estadoAtencion !== q.atencion)) continue;
        const fila = {
          id: i.id,
          inscripcionId: i.id,
          alumno: i.alumno.usuario.nombreCompleto,
          matricula: i.alumno.matricula,
          grupo: i.grupo.nombre,
          grupoId: i.grupoId,
          ciclo: i.grupo.ciclo.nombre,
          cicloId: i.grupo.cicloId,
          plantelId: i.grupo.plantelId,
          estado: pendiente ? 'PENDIENTE_RESPUESTA' : (r?.estado ?? 'PENDIENTE_PUBLICACION'),
          ultimaRespuesta: r?.estado ?? null,
          fecha: r?.createdAt ?? null,
          vigente,
          disponible: v.disponible,
          atencion: estadoAtencion,
          responsable: t?.responsable.nombreCompleto ?? null,
        };
        if (total >= desde && datos.length < q.porPagina) datos.push(fila);
        total++;
      }
    }
    return { datos, total, pagina: q.pagina, porPagina: q.porPagina };
  }
}
