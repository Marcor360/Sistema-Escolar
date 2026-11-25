import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { expedienteHistorico } from '../alumnos/expediente-historico';
import { readFile } from 'fs/promises';
import { resolve, sep } from 'path';
import { gzipSync } from 'zlib';
import { createHash, X509Certificate } from 'crypto';
import { DataSource, EntityManager, Not } from 'typeorm';
import {
  Cargo,
  Pago,
  TitulacionFirmante,
  Inscripcion,
  ParticipacionAsignatura,
  EgresoAlumno,
  EgresoDocumento,
} from '../entities';
import { CargosService } from '../finanzas/cargos.service';
import { ScopeService } from '../planteles/scope.service';
import { JwtUser } from '../common/current-user.decorator';
import { fechaElegibleArchivo } from '../alumnos/egreso-alumno';
import { validarEsquema } from './validar-esquema';
import { historialEgreso } from './historial-egreso';
import { documentoSep, escaparXml, perfilSep } from './xml-egreso';
import { EvidenciaDto, ExpedicionDto } from './documentos-egreso.dto';

const huella = (v: string | Buffer) => createHash('sha256').update(v).digest('hex');
const requisitos = ['NO_ADEUDO', 'SERVICIO_SOCIAL', 'CONCLUSION'];
function exigir(actor: JwtUser, ...roles: string[]) {
  if (actor.portal === 'MOVIL' || !roles.some((r) => actor.roles.includes(r)))
    throw new ForbiddenException('Tu función no permite esta operación');
}
const cerrado = (e: EgresoAlumno) =>
  e.estadoArchivo === 'ARCHIVADO' || (e.estadoArchivo === 'VIGENTE' && e.archivarDesde.getTime() <= Date.now());

@Injectable()
export class DocumentosEgresoService {
  constructor(
    private ds: DataSource,
    private scope: ScopeService,
    private cargos: CargosService,
  ) {}
  private async obtener(m: EntityManager, matricula: string, actor: JwtUser, escritura = false) {
    exigir(actor, 'ADMINISTRATIVO', 'DIRECTOR', 'FINANZAS');
    const e = await m.findOne(EgresoAlumno, {
      where: { alumno: { matricula } },
      relations: { alumno: { usuario: true }, ciclo: true },
    });
    if (!e) throw new NotFoundException('No se encontró un egreso conciliado para esa matrícula');
    await this.scope.validarGestion(actor, e.alumno.plantelId);
    const permitidos = await this.scope.plantelesDe(actor);
    if (permitidos !== null) {
      const inscripciones = await m.find(Inscripcion, {
        where: { alumnoId: e.alumnoId },
        relations: { grupo: true },
        loadEagerRelations: false,
      });
      const intentos = await m.find(ParticipacionAsignatura, {
        where: { alumnoId: e.alumnoId },
        relations: { grupoMateria: { grupo: true } },
        loadEagerRelations: false,
      });
      const cargos = await m.find(Cargo, {
        where: { alumnoId: e.alumnoId },
        select: { plantelId: true },
        loadEagerRelations: false,
      });
      const pagos = await m.find(Pago, {
        where: { alumnoId: e.alumnoId },
        select: { plantelId: true },
        loadEagerRelations: false,
      });
      if (
        [
          ...inscripciones.map((i) => i.grupo.plantelId),
          ...intentos.map((i) => i.grupoMateria.grupo.plantelId),
          ...cargos.map((c) => c.plantelId),
          ...pagos.map((p) => p.plantelId),
        ].some((id) => !permitidos.includes(id))
      )
        throw new ForbiddenException('Se requiere alcance sobre todos los planteles del expediente');
    }
    if (escritura && (cerrado(e) || e.finalizadoEn || e.alumno.estatus !== 'EGRESADO'))
      throw new ConflictException('El expediente está cerrado o el alumno no está egresado');
    return e;
  }
  async consultar(matricula: string, actor: JwtUser) {
    const e = await this.obtener(this.ds.manager, matricula, actor);
    const documentos = await this.ds.manager.find(EgresoDocumento, {
      where: { egresoId: e.id },
      order: { id: 'DESC' },
    });
    const inscripciones = actor.roles.some((r) => r === 'DIRECTOR' || r === 'ADMINISTRATIVO')
      ? await this.ds.manager.find(Inscripcion, {
          where: { alumnoId: e.alumnoId },
          relations: { grupo: { carrera: true } },
          loadEagerRelations: false,
        })
      : [];
    const planes = [
      ...new Map(
        inscripciones.flatMap((i) =>
          i.grupo.carrera
            ? [
                [
                  i.grupo.carrera.id,
                  { id: i.grupo.carrera.id, nombre: i.grupo.carrera.nombre, version: i.grupo.carrera.versionPlan },
                ] as const,
              ]
            : [],
        ),
      ).values(),
    ];
    return {
      planes,
      matricula: e.alumno.matricula,
      nombre: e.alumno.usuario.nombreCompleto,
      archivarDesde: e.estadoArchivo === 'EN_TRAMITE' ? null : e.archivarDesde,
      cerrado: cerrado(e) || !!e.finalizadoEn,
      finalizadoEn: e.finalizadoEn,
      documentos: documentos
        .filter(
          (d) => actor.roles.some((r) => ['ADMINISTRATIVO', 'DIRECTOR'].includes(r)) || d.tipo === 'NO_ADEUDO',
        )
        .map((d) => ({
          id: d.id,
          tipo: d.tipo,
          detalle: d.detalle,
          actorId: d.actorId,
          fecha: d.createdAt,
          sha256: d.sha256,
        })),
    };
  }
  private async finanzas(m: EntityManager, id: number) {
    const cargos = await m.find(Cargo, {
      where: { alumnoId: id, estatus: Not('CANCELADO') },
      loadEagerRelations: false,
      order: { id: 'ASC' },
    });
    const abonos = await this.cargos.pagadoPorCargo(
      cargos.map((c) => c.id),
      m,
    );
    return cargos.map((c) => ({ id: c.id, total: this.cargos.totalDeCargo(c), pagado: abonos.get(c.id) || 0 }));
  }
  private async guardar(
    m: EntityManager,
    e: EgresoAlumno,
    actor: JwtUser,
    tipo: string,
    detalle: string,
    contexto: string,
    mime: string,
    bytes: Buffer,
    instantanea?: string,
  ) {
    const sha256 = huella(bytes),
      clave = huella(JSON.stringify([e.id, actor.sub, tipo, detalle, contexto, sha256]));
    const existente = await m.findOneBy(EgresoDocumento, { clave });
    if (existente) return { id: existente.id, tipo, sha256 };
    const d = await m.save(EgresoDocumento, {
      egresoId: e.id,
      actorId: actor.sub,
      tipo,
      detalle,
      contexto,
      mime,
      sha256,
      clave,
      instantanea,
      contenido: bytes.toString('base64'),
    });
    return { id: d.id, tipo, sha256 };
  }
  evidencia(matricula: string, d: EvidenciaDto, archivo: Express.Multer.File | undefined, actor: JwtUser) {
    exigir(actor, d.tipo === 'NO_ADEUDO' ? 'FINANZAS' : 'ADMINISTRATIVO');
    if ((!archivo && d.tipo !== 'CONCLUSION') || (archivo && archivo.buffer.subarray(0, 5).toString() !== '%PDF-'))
      throw new BadRequestException('Adjunta la hoja firmada en PDF');
    return this.ds.transaction('SERIALIZABLE', async (m) => {
      const e = await this.obtener(m, matricula, actor, true);
      let contexto = '';
      if (d.tipo === 'NO_ADEUDO') {
        const cuenta = await this.finanzas(m, e.alumnoId);
        if (cuenta.some((c) => c.total > c.pagado))
          throw new ConflictException('Hay cargos pendientes de liquidación');
        contexto = huella(JSON.stringify(cuenta));
      } else if (d.tipo === 'CONCLUSION') {
        const h = await historialEgreso(m, e.alumnoId);
        if (
          !h.materias.some((f) => f.estado !== 'BAJA') ||
          h.materias.some(
            (f) =>
              f.estado !== 'BAJA' &&
              (!f.publicada || f.resultado === null || (f.intento > 0 && f.estado !== 'FINALIZADA')),
          )
        )
          throw new ConflictException('Hay asignaturas sin resultado definitivo o recursamientos pendientes');
        contexto = huella(JSON.stringify(h));
      }
      if (e.estadoArchivo === 'VIGENTE') await m.update(EgresoAlumno, e.id, { estadoArchivo: 'EN_TRAMITE' });
      const acta =
        '<Conclusion matricula="' +
        escaparXml(e.alumno.matricula) +
        '" actor="' +
        actor.sub +
        '" historial="' +
        contexto +
        '">' +
        escaparXml(d.detalle.trim()) +
        '</Conclusion>';
      return this.guardar(
        m,
        e,
        actor,
        d.tipo,
        d.detalle.trim(),
        contexto,
        archivo ? 'application/pdf' : 'application/xml',
        archivo?.buffer ?? Buffer.from(acta),
      );
    });
  }
  expedir(matricula: string, d: ExpedicionDto, actor: JwtUser) {
    if (d.tipo === 'TITULO') exigir(actor, 'DIRECTOR');
    else exigir(actor, 'ADMINISTRATIVO', 'DIRECTOR');
    return this.ds.transaction('SERIALIZABLE', async (m) => {
      const e = await this.obtener(m, matricula, actor, true);
      const documentos = await m.find(EgresoDocumento, { where: { egresoId: e.id }, order: { id: 'DESC' } });
      const liberaciones = requisitos.map((t) => documentos.find((doc) => doc.tipo === t));
      if (liberaciones.some((v) => !v))
        throw new ConflictException('Faltan la carta de no adeudo, el servicio social o la conclusión del plan');
      const h = await historialEgreso(m, e.alumnoId),
        cuenta = await this.finanzas(m, e.alumnoId);
      if (
        cuenta.some((c) => c.total > c.pagado) ||
        liberaciones[0]!.contexto !== huella(JSON.stringify(cuenta)) ||
        liberaciones[2]!.contexto !== huella(JSON.stringify(h))
      )
        throw new ConflictException('La cuenta o el historial cambiaron. Revalida la liberación correspondiente');
      const contexto = huella(JSON.stringify(liberaciones.map((v) => v!.id)));
      if (d.tipo === 'FINALIZACION') {
        if (!documentos.some((doc) => !requisitos.includes(doc.tipo)))
          throw new ConflictException('Expide los documentos antes de finalizar el expediente');
        const fecha = new Date(),
          archivarDesde = fechaElegibleArchivo(fecha);
        await m.update(EgresoAlumno, e.id, { finalizadoEn: fecha, archivarDesde, estadoArchivo: 'VIGENTE' });
        return { archivarDesde };
      }
      let xml: string;
      if (d.tipo === 'TITULO' || d.tipo === 'CERTIFICADO') {
        if (!d.carreraPlanId || !h.materias.some((f) => f.carreraPlanId === d.carreraPlanId))
          throw new ConflictException('El plan no figura en el historial');
        const perfil = perfilSep(e.alumno.plantelId, d.carreraPlanId, actor.sub);
        const firmante = await m.findOneBy(TitulacionFirmante, {
          id: perfil.firmanteId,
          plantelId: e.alumno.plantelId,
        });
        const hoy = new Date().toISOString().slice(0, 10);
        if (
          !firmante ||
          firmante.estado === 'INACTIVO' ||
          firmante.curp !== perfil.firma.curp ||
          firmante.certificadoSha256 !== huella(new X509Certificate(perfil.certificado).raw) ||
          firmante.vigenteDesde > hoy ||
          (firmante.vigenteHasta && firmante.vigenteHasta < hoy)
        )
          throw new ForbiddenException('Revisa el registro, certificado y vigencia del firmante institucional');
        const folio = `IUA-${e.id}-${d.carreraPlanId}-${d.tipo}-${liberaciones.map((v) => v!.id).join('-')}`;
        const resultado = documentoSep(d.tipo, e, h, perfil, folio, d.datos ?? {}, d.sello);
        if (!d.sello) return { cadena: resultado.cadena, folio };
        xml = resultado.xml;
        await validarEsquema(d.tipo, xml);
        const anterior = documentos.find((doc) => doc.tipo === d.tipo && doc.detalle === folio);
        if (anterior && anterior.sha256 !== huella(xml)) throw new ConflictException('Este folio ya está emitido');
        return this.registrarEmision(m, e, actor, d.tipo, folio, contexto, xml);
      }
      const attrs = (v: Record<string, string | number>) =>
        Object.entries(v)
          .map(([k, val]) => ` ${k}="${escaparXml(val)}"`)
          .join('');
      const filas = h.materias
        .map(
          (f) =>
            `<Asignatura${attrs({ clave: f.materia, nombre: f.nombre, ciclo: f.ciclo, grupo: f.grupo, resultado: f.resultado ?? '', escala: f.escala, intento: f.intento, estado: f.estado })}>${f.notas.map((n) => `<Nota${attrs(n)}/>`).join('')}</Asignatura>`,
        )
        .join('');
      const contenido = d.tipo === 'CONSTANCIA' ? '' : filas;
      const historial = d.tipo === 'HISTORIAL' ? await expedienteHistorico(m, e, false) : null;
      const detalleHistorial = historial
        ? '<Expediente formato="json">' +
          escaparXml(
            JSON.stringify({
              ...historial,
              exportadoEn: undefined,
              documentos: historial.documentos.filter((v) => requisitos.includes(v.tipo)),
            }),
          ) +
          '</Expediente>'
        : '';
      xml = `<?xml version="1.0" encoding="UTF-8"?><DocumentoEscolar${attrs({ tipo: d.tipo, egreso: e.id, cicloEgreso: e.ciclo.clave, matricula: e.alumno.matricula, nombre: e.alumno.usuario.nombreCompleto, emisor: actor.sub, liberacionFinanzas: liberaciones[0]!.id, liberacionServicio: liberaciones[1]!.id, conclusion: liberaciones[2]!.id })}>${contenido}${detalleHistorial}</DocumentoEscolar>`;
      return this.registrarEmision(m, e, actor, d.tipo, d.tipo, contexto, xml);
    });
  }
  private async registrarEmision(
    m: EntityManager,
    e: EgresoAlumno,
    actor: JwtUser,
    tipo: string,
    detalle: string,
    contexto: string,
    xml: string,
  ) {
    const instantanea = await expedienteHistorico(m, e, false);
    return this.guardar(
      m,
      e,
      actor,
      tipo,
      detalle,
      contexto,
      'application/xml',
      Buffer.from(xml),
      JSON.stringify(instantanea),
    );
  }
  async archivo(matricula: string, actor: JwtUser) {
    exigir(actor, 'ADMINISTRATIVO', 'DIRECTOR');
    return this.ds.transaction('SERIALIZABLE', async (m) => {
      const e = await this.obtener(m, matricula, actor);
      if (e.estadoArchivo === 'ARCHIVADO') {
        const base = process.env.EGRESOS_ARCHIVE_DIR;
        if (!base || !e.rutaArchivo) throw new ConflictException('Revisa la ubicación del archivo');
        const ruta = resolve(base, e.rutaArchivo);
        if (!ruta.startsWith(resolve(base) + sep)) throw new ConflictException('Ruta de archivo inválida');
        const bytes = await readFile(ruta);
        if (huella(bytes) !== e.sha256Archivo)
          throw new ConflictException('El archivo requiere revisión de integridad');
        return bytes;
      }
      return gzipSync(JSON.stringify(await expedienteHistorico(m, e, true)));
    });
  }
  async instantanea(matricula: string, id: number, actor: JwtUser) {
    exigir(actor, 'ADMINISTRATIVO', 'DIRECTOR');
    const e = await this.obtener(this.ds.manager, matricula, actor);
    const d = await this.ds.manager.findOne(EgresoDocumento, {
      where: { id, egresoId: e.id },
      select: { id: true, instantanea: true },
    });
    if (!d?.instantanea) throw new NotFoundException();
    return Buffer.from(d.instantanea);
  }
  async descargar(matricula: string, id: number, actor: JwtUser) {
    const e = await this.obtener(this.ds.manager, matricula, actor);
    const d = await this.ds
      .getRepository(EgresoDocumento)
      .createQueryBuilder('d')
      .addSelect('d.contenido')
      .where('d.id=:id AND d.egresoId=:egreso', { id, egreso: e.id })
      .getOne();
    if (!d) throw new NotFoundException();
    if (d.tipo !== 'NO_ADEUDO') exigir(actor, 'ADMINISTRATIVO', 'DIRECTOR');
    const bytes = Buffer.from(d.contenido, 'base64');
    if (huella(bytes) !== d.sha256) throw new ConflictException('El documento requiere revisión de integridad');
    return { bytes, mime: d.mime, nombre: d.tipo + '-' + d.id + (d.mime === 'application/pdf' ? '.pdf' : '.xml') };
  }
}
