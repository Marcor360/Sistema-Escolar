import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { ScopeService } from '../planteles/scope.service';
import { JwtUser } from '../common/current-user.decorator';
import { promedioOficial } from '../common/promedio-oficial';
import { CicloEscolar } from '../entities/ciclo-escolar.entity';
import { GrupoMateria } from '../entities/grupo-materia.entity';
import { Calificacion } from '../entities/calificacion.entity';
import { Inscripcion } from '../entities/inscripcion.entity';
import { Actividad } from '../entities/actividad.entity';
import { Entrega } from '../entities/entrega.entity';
import { Cargo } from '../entities/cargo.entity';
import { Pago } from '../entities/pago.entity';
import { AnaliticaDto } from './analitica.dto';
@Injectable()
export class AnaliticaService {
  constructor(private readonly ds: DataSource, private readonly scope: ScopeService) {}
  async consultar(query: AnaliticaDto, user: JwtUser) {
    const ciclo = await this.ds.getRepository(CicloEscolar).findOne({ where: query.cicloId ? { id: query.cicloId } : { activo: true } });
    if (!ciclo) throw new NotFoundException('Selecciona un ciclo existente');
    const planteles = await this.scope.resolverFiltro(user, query.plantelId);
    const maestro = user.roles.includes('MAESTRO') && !user.roles.some((r) => ['SUPERADMIN', 'ADMINISTRATIVO'].includes(r));
    const soloFinanzas = user.roles.includes('FINANZAS') && !user.roles.some((r) => ['SUPERADMIN', 'ADMINISTRATIVO', 'MAESTRO'].includes(r));
    const contexto = { ciclo: { id: ciclo.id, nombre: ciclo.nombre }, plantelId: query.plantelId ?? null, generadoEn: new Date().toISOString() };
    let academico: { clases: unknown[]; regla: string } | undefined;
    if (!soloFinanzas) {
      const clases = await this.ds.getRepository(GrupoMateria).find({ where: {
        ...(query.materiaId ? { materiaId: query.materiaId } : {}),
        ...(maestro ? { docente: { usuarioId: user.sub, estatus: 'ACTIVO' } } : {}),
        materia: { activo: true },
        grupo: { cicloId: ciclo.id, ...(!query.cicloId ? { activo: true, plantel: { activo: true } } : {}), ...(query.grupoId ? { id: query.grupoId } : {}), ...(planteles === null ? {} : { plantelId: In(planteles) }) },
      } });
      const ids = clases.map((c) => c.id); const grupos = [...new Set(clases.map((c) => c.grupoId))];
      const [notas, inscripciones, actividades] = ids.length ? await Promise.all([
        this.ds.getRepository(Calificacion).find({ where: { grupoMateriaId: In(ids) } }),
        this.ds.getRepository(Inscripcion).find({ where: { grupoId: In(grupos), ...(query.cicloId ? {} : { estatus: 'ACTIVA', alumno: { estatus: 'ACTIVO', usuario: { activo: true } } }) } }),
        this.ds.getRepository(Actividad).find({ where: { grupoMateriaId: In(ids), activo: true } }),
      ]) : [[], [], []];
      const entregas = actividades.length ? await this.ds.getRepository(Entrega).find({ where: { actividadId: In(actividades.map((a) => a.id)) } }) : [];
      academico = { regla: 'Indicador descriptivo: P1-P3 completos, aprobación orientativa >=60; no modifica notas ni clasifica personas automáticamente.', clases: clases.map((clase) => {
        const roster = inscripciones.filter((i) => i.grupoId === clase.grupoId);
        const promedios = roster.map((i) => promedioOficial(new Map(notas.filter((n) => n.alumnoId === i.alumnoId && n.grupoMateriaId === clase.id).map((n) => [n.parcial, Number(n.calificacion)])))).filter((v): v is number => v !== null);
        const parciales = [1, 2, 3].map((parcial) => { const valores = notas.filter((n) => n.grupoMateriaId === clase.id && n.parcial === parcial && roster.some((i) => i.alumnoId === n.alumnoId));
          return { parcial, capturados: valores.length, faltantes: roster.length - valores.length, promedio: valores.length ? Math.round(valores.reduce((s, n) => s + Number(n.calificacion), 0) / valores.length * 10) / 10 : null }; });
        const vencidas = actividades.filter((a) => a.grupoMateriaId === clase.id && a.fechaEntrega && a.fechaEntrega < new Date());
        const esperadas = vencidas.length * roster.length;
        const recibidas = entregas.filter((e) => vencidas.some((a) => a.id === e.actividadId) && roster.some((i) => i.alumnoId === e.alumnoId)).length;
        return { grupoMateriaId: clase.id, grupo: clase.grupo.nombre, materia: clase.materia.nombre, plantel: clase.grupo.plantel.nombre,
          inscritos: roster.length, oficialesCompletos: promedios.length, promedioOficial: promedios.length ? Math.round(promedios.reduce((s, n) => s + n, 0) / promedios.length * 10) / 10 : null,
          aprobados: promedios.filter((n) => n >= 60).length, bajoReferencia: promedios.filter((n) => n < 60).length, parciales,
          entregasEsperadas: esperadas, entregasRecibidas: recibidas, entregasFaltantes: esperadas - recibidas };
      }) };
    }
    let financiero: { cargos: number; facturado: number; aplicado: number; saldo: number } | undefined;
    if (!maestro && user.roles.some((r) => ['SUPERADMIN', 'ADMINISTRATIVO', 'FINANZAS'].includes(r))) {
      const cargos = await this.ds.getRepository(Cargo).find({ where: { cicloId: ciclo.id, alumno: planteles === null ? {} : { plantelId: In(planteles) } } });
      const vigentes = cargos.filter((c) => c.estatus !== 'CANCELADO');
      const pagos = vigentes.length ? await this.ds.getRepository(Pago).find({ where: { cargoId: In(vigentes.map((c) => c.id)), estatus: 'CONFIRMADO' } }) : [];
      const facturado = vigentes.reduce((s, c) => s + Number(c.monto) - Number(c.descuento) + Number(c.recargo), 0);
      const aplicado = pagos.reduce((s, p) => s + Number(p.monto), 0);
      financiero = { cargos: vigentes.length, facturado: Math.round(facturado * 100) / 100, aplicado: Math.round(aplicado * 100) / 100, saldo: Math.round((facturado - aplicado) * 100) / 100 };
    }
    return { ...contexto, ...(academico ? { academico } : {}), ...(financiero ? { financiero } : {}) };
  }
}
