import { ConflictException } from '@nestjs/common';
import { PeriodoCalificacion } from '../entities/periodo-calificacion.entity';
import { boletaPublicable } from './publicacion-boleta';
import { contentDisposition } from '../common/content-disposition';
import { esRegimenNuevo, notaEnEscala, resultadoMapa } from '../common/regimen-evaluacion';
import { Inscripcion } from '../entities/inscripcion.entity';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfiguracionService } from '../configuracion/configuracion.service';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { Response } from 'express';
import PDFDocument from 'pdfkit';
import * as ExcelJS from 'exceljs';
import { Alumno } from '../entities/alumno.entity';
import { Docente } from '../entities/docente.entity';
import { Grupo } from '../entities/grupo.entity';
import { GrupoMateria } from '../entities/grupo-materia.entity';
import { Calificacion } from '../entities/calificacion.entity';
import { Pago } from '../entities/pago.entity';
import { CargosService } from '../finanzas/cargos.service';
import { DocentesService } from '../docentes/docentes.service';
import { AlumnosService } from '../alumnos/alumnos.service';
import { ScopeService } from '../planteles/scope.service';
import { JwtUser } from '../common/current-user.decorator';

@Injectable()
export class ReportesService {
  constructor(
    @InjectRepository(Alumno) private readonly alumnos: Repository<Alumno>,
    @InjectRepository(Docente) private readonly docentesRepo: Repository<Docente>,
    @InjectRepository(Grupo) private readonly grupos: Repository<Grupo>,
    @InjectRepository(GrupoMateria) private readonly grupoMaterias: Repository<GrupoMateria>,
    @InjectRepository(Calificacion) private readonly calificaciones: Repository<Calificacion>,
    @InjectRepository(Pago) private readonly pagos: Repository<Pago>,
    private readonly cargos: CargosService,
    private readonly docentes: DocentesService,
    private readonly alumnosService: AlumnosService,
    private readonly scope: ScopeService,
    private readonly configuracion: ConfiguracionService,
  ) {}

  /** Contadores para el dashboard. */
  async resumen(user: JwtUser, plantelId?: number) {
    const planteles = await this.scope.resolverFiltro(user, plantelId);
    const alumnoWhere = planteles === null ? { estatus: 'ACTIVO' as const } : { estatus: 'ACTIVO' as const, plantelId: this.scope.condicion(planteles) };
    const grupoWhere = planteles === null ? {} : { plantelId: this.scope.condicion(planteles) };
    const docentesQb = this.docentesRepo
      .createQueryBuilder('d')
      .innerJoin('d.usuario', 'u')
      .where('d.estatus = :estatusDocente', { estatusDocente: 'ACTIVO' });
    if (planteles !== null) {
      docentesQb.andWhere(
        'EXISTS (SELECT 1 FROM usuario_planteles up WHERE up.usuario_id = u.id AND up.plantel_id IN (:...planteles) AND up.activo = :asignacionActiva)',
        { planteles, asignacionActiva: true },
      );
    }
    const [alumnosActivos, docentesActivos, totalGrupos] = await Promise.all([
      this.alumnos.count({ where: alumnoWhere }),
      docentesQb.getCount(),
      this.grupos.count({ where: grupoWhere }),
    ]);
    const adeudos = await this.cargos.adeudos(user, plantelId);
    const saldoPendiente = Math.round(adeudos.reduce((s, c) => s + c.saldo, 0) * 100) / 100;
    const porAlumno = new Map<number, { abonado: number; saldo: number; vencidos: number }>();
    const hoyMexico = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City',
      year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    for (const cargo of adeudos) {
      if (cargo.alumno.estatus !== 'ACTIVO') continue;
      const datos = porAlumno.get(cargo.alumnoId) ?? { abonado: 0, saldo: 0, vencidos: 0 };
      datos.abonado += cargo.pagado;
      datos.saldo += cargo.saldo;
      if (cargo.fechaVencimiento && cargo.fechaVencimiento < hoyMexico) datos.vencidos++;
      porAlumno.set(cargo.alumnoId, datos);
    }
    const alumnosSinAbono = [...porAlumno.values()].filter(v => v.abonado === 0).length;
    const alumnosConAbonoParcial = [...porAlumno.values()].filter(v => v.abonado > 0).length;
    const alumnosConVencidos = [...porAlumno.values()].filter(v => v.vencidos > 0).length;

    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);
    const pagosQb = this.pagos
      .createQueryBuilder('p')
      .select('COALESCE(SUM(p.monto), 0)', 'total')
      .innerJoin('p.alumno', 'a')
      .where('p.estatus = :e', { e: 'CONFIRMADO' })
      .andWhere('p.fecha_pago >= :d', { d: inicioMes });
    if (planteles !== null) pagosQb.andWhere('p.plantel_id IN (:...planteles)', { planteles });
    const pagosMes = await pagosQb.getRawOne<{ total: string }>();

    return {
      alumnosActivos,
      docentesActivos,
      grupos: totalGrupos,
      saldoPendiente,
      cargosConAdeudo: adeudos.length,
      alumnosConSaldo: porAlumno.size,
      alumnosSinAbono,
      alumnosConAbonoParcial,
      alumnosConVencidos,
      cobradoMes: Number(pagosMes?.total ?? 0),
    };
  }

  /** El maestro solo exporta sus clases; ADMINISTRATIVO y SUPERADMIN, cualquiera. */
  async validarAccesoAClase(grupoMateriaId: number, user: JwtUser): Promise<GrupoMateria> {
    const gm = await this.grupoMaterias.findOne({ where: { id: grupoMateriaId }, relations: ['grupo.carrera', 'grupo.periodoAcademico'] });
    if (!gm) throw new NotFoundException('Grupo-materia no encontrado');
    if (user.roles.includes('SUPERADMIN')) return gm;
    if (user.roles.includes('ADMINISTRATIVO')) {
      await this.scope.validarGestion(user, gm.grupo.plantelId);
      return gm;
    }
    const docente = await this.docentes.obtenerPorUsuario(user.sub);
    if (gm.docenteId !== docente.id) {
      throw new ForbiddenException('La materia no está asignada a este docente');
    }
    if (!gm.grupo.activo) throw new ForbiddenException('El grupo no está activo');
    return gm;
  }

  /** Concentrado de calificaciones de una clase (parciales, final y promedio) en Excel. */
  async calificacionesExcel(grupoMateriaId: number, user: JwtUser, res: Response) {
    const gm = await this.validarAccesoAClase(grupoMateriaId, user);
    const registros = await this.calificaciones.find({
      where: { grupoMateriaId },
      order: { alumnoId: 'ASC', parcial: 'ASC' },
    });

    const inscritos = await this.grupos.manager.getRepository(Inscripcion).find({
      where: { grupoId: gm.grupoId, estatus: In(['ACTIVA','HISTORICA']), alumno: { estatus: 'ACTIVO' } },
      order: { alumnoId: 'ASC' },
    });
    // Pivote: todas las inscripciones, incluso sin calificación.
    const filas = new Map<number, { matricula: string; nombre: string; parciales: Map<number, number> }>();
    for (const i of inscritos) filas.set(i.alumnoId, {
      matricula: i.alumno.matricula, nombre: i.alumno.usuario.nombreCompleto, parciales: new Map(),
    });
    for (const r of registros) {
      if (!filas.has(r.alumnoId)) continue;
      const fila = filas.get(r.alumnoId) ?? {
        matricula: r.alumno.matricula,
        nombre: r.alumno.usuario.nombreCompleto,
        parciales: new Map<number, number>(),
      };
      fila.parciales.set(r.parcial, notaEnEscala(r, gm));
      filas.set(r.alumnoId, fila);
    }

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Calificaciones');
    ws.columns = [
      { header: 'Matrícula', key: 'matricula', width: 14 },
      { header: 'Alumno', key: 'nombre', width: 34 },
      { header: 'Parcial 1', key: 'p1', width: 11 },
      { header: 'Parcial 2', key: 'p2', width: 11 },
      { header: 'Parcial 3', key: 'p3', width: 11 },
      ...(esRegimenNuevo(gm) ? [{ header: 'Parcial 4', key: 'p4', width: 11 }] : []),
      { header: 'Final manual', key: 'final', width: 11 },
      { header: 'Promedio', key: 'promedio', width: 11 },
    ];
    ws.getRow(1).font = { bold: true };

    for (const fila of filas.values()) {
      const valores = [1, 2, 3].map((p) => fila.parciales.get(p));
      const promedio = resultadoMapa(fila.parciales, gm);
      ws.addRow({
        matricula: fila.matricula,
        nombre: fila.nombre,
        p1: valores[0] ?? '',
        p2: valores[1] ?? '',
        p3: valores[2] ?? '',
        p4: fila.parciales.get(4) ?? '',
        final: fila.parciales.get(0) ?? '',
        promedio: promedio ?? '',
      });
    }

    const nombre = `calificaciones-${gm.grupo.nombre}-${gm.materia.clave}.xlsx`.replace(/\s+/g, '_');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', contentDisposition(nombre, 'attachment'));
    await wb.xlsx.write(res);
    res.end();
  }

  async misBoletas(user: JwtUser) {
    const alumno = await this.alumnosService.obtenerPorUsuario(user.sub);
    const inscripciones = await this.grupos.manager.getRepository(Inscripcion).find({ where: { alumnoId: alumno.id }, order: { id: 'DESC' } });
    return inscripciones.map((i) => ({ inscripcionId: i.id, cicloId: i.grupo.cicloId, ciclo: i.grupo.ciclo.nombre, grupo: i.grupo.nombre, plantel: i.grupo.plantel.nombre }));
  }

  /** Boleta PDF básica: calificaciones por materia y parcial + promedios. */
  async boletaPdf(alumnoId: number, user: JwtUser, res: Response, cicloId?: number, inscripcionId?: number) {
    const alumno = await this.alumnos.findOne({ where: { id: alumnoId } });
    if (!alumno) throw new NotFoundException('Alumno no encontrado');
    if (user.roles.includes('ALUMNO')) {
      const propio = await this.alumnosService.obtenerPorUsuario(user.sub);
      if (propio.id !== alumno.id) throw new ForbiddenException('No puedes consultar la boleta de otro alumno');
    } else if (!user.roles.some((rol) => ['SUPERADMIN', 'ADMINISTRATIVO'].includes(rol))) {
      throw new ForbiddenException('La boleta completa es exclusiva del alumno y control escolar; usa el concentrado de tus clases');
    }
    const inscripciones = await this.grupos.manager.getRepository(Inscripcion).find({
      where: { alumnoId, ...(inscripcionId ? { id: inscripcionId } : {}), grupo: cicloId ? { cicloId } : { ciclo: { activo: true } } },
      order: { id: 'DESC' },
    });
    if (!inscripciones.length) throw new NotFoundException('El alumno no tiene inscripción en el ciclo solicitado');
    if (inscripciones.length > 1 && !inscripcionId) throw new BadRequestException('Selecciona una inscripción para emitir la boleta de este ciclo');
    const inscripcion = inscripciones[0];
    // El alcance histórico corresponde al plantel de la inscripción, no al plantel actual tras una transferencia.
    if (!user.roles.includes('ALUMNO')) await this.scope.validarGestion(user, inscripcion.grupo.plantelId);
    const calificaciones = await this.calificaciones.find({
      where: { alumnoId, grupoMateria: { grupoId: inscripcion.grupoId } },
      order: { grupoMateriaId: 'ASC', parcial: 'ASC' },
    });

    const clasesBoleta = await this.grupoMaterias.find({ where: { grupoId: inscripcion.grupoId } });
    if (user.roles.includes('ALUMNO')) {
      const periodos = await this.grupos.manager.getRepository(PeriodoCalificacion).find({ where: { grupoMateria: { grupoId: inscripcion.grupoId } } });
      if (!boletaPublicable(clasesBoleta,calificaciones,periodos)) throw new ConflictException('La boleta estará disponible cuando Control Escolar cierre las evaluaciones requeridas');
    }
    const materias = new Map<number, { nombre: string; parciales: Map<number, number>; regimenEvaluacion?: string }>();
    for (const clase of clasesBoleta) {
      materias.set(clase.id, { nombre: clase.materia.nombre, regimenEvaluacion: clase.regimenEvaluacion, parciales: new Map() });
    }
    for (const c of calificaciones) {
      const fila = materias.get(c.grupoMateriaId) ?? {
        nombre: c.grupoMateria?.materia?.nombre ?? `Materia ${c.grupoMateriaId}`,
        parciales: new Map<number, number>(),
      };
      fila.parciales.set(c.parcial, notaEnEscala(c, clasesBoleta.find(g=>g.id===c.grupoMateriaId) ?? c.grupoMateria));
      materias.set(c.grupoMateriaId, fila);
    }

    const institucion = (await this.configuracion.obtener()).nombreInstitucion;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', contentDisposition(`boleta-${alumno.matricula}.pdf`, 'inline'));

    const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
    doc.pipe(res);

    doc.fontSize(16).font('Helvetica-Bold').text(institucion, { align: 'center' });
    doc.fontSize(12).font('Helvetica').text('Boleta de calificaciones', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10);
    doc.text(`Alumno: ${alumno.usuario.nombreCompleto}`);
    doc.text(`Matrícula: ${alumno.matricula}`);
    doc.text(`Ciclo: ${inscripcion.grupo.ciclo.nombre} · Grupo: ${inscripcion.grupo.nombre}`);
    doc.text(`Plantel: ${inscripcion.grupo.plantel.nombre} · Inscripción: ${inscripcion.id}`);
    doc.text(`Fecha de emisión: ${new Date().toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City' })}`);
    doc.moveDown();

    const x = 50;
    let y = doc.y;
    const nuevo = clasesBoleta.some(esRegimenNuevo);
    const anchos = nuevo ? [170, 45, 45, 45, 45, 70, 70] : [190, 60, 60, 60, 60, 70];
    const encabezados = ['Materia', 'P1', 'P2', 'P3', ...(nuevo ? ['P4'] : []), 'Final', 'Promedio'];
    doc.font('Helvetica-Bold');
    encabezados.forEach((h, i) => {
      doc.text(h, x + anchos.slice(0, i).reduce((a, b) => a + b, 0), y, { width: anchos[i] });
    });
    doc.font('Helvetica');
    y += 18;
    doc.moveTo(x, y - 4).lineTo(x + anchos.reduce((a, b) => a + b, 0), y - 4).stroke();

    const promediosGenerales: number[] = [];
    for (const fila of materias.values()) {
      const valores = (nuevo ? [1, 2, 3, 4] : [1, 2, 3]).map((p) => fila.parciales.get(p));
      const promedio = resultadoMapa(fila.parciales, fila);
      if (promedio !== null) promediosGenerales.push(promedio);

      const celdas = [
        fila.nombre,
        ...valores.map((v) => (v === undefined ? '—' : String(v))),
        fila.parciales.has(0) ? String(fila.parciales.get(0)) : '—',
        promedio === null ? '—' : String(promedio),
      ];
      celdas.forEach((c, i) => {
        doc.text(String(c), x + anchos.slice(0, i).reduce((a, b) => a + b, 0), y, { width: anchos[i] });
      });
      y += 16;
      if (y > 700) { doc.addPage(); y = 60; }
    }

    doc.moveDown(2);
    const promedioGeneral = promediosGenerales.length
      ? (nuevo ? String(promediosGenerales.reduce((a,b)=>a+b,0)/promediosGenerales.length) : (promediosGenerales.reduce((a, b) => a + b, 0) / promediosGenerales.length).toFixed(1))
      : '—';
    doc.font('Helvetica-Bold').text(`Promedio general: ${promedioGeneral}`, x, y + 10);
    doc.end();
  }

  /** Reporte de adeudos en Excel. */
  async adeudosExcel(user: JwtUser, res: Response, plantelId?: number) {
    const adeudos = await this.cargos.adeudos(user, plantelId);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Adeudos');
    ws.columns = [
      { header: 'Matrícula', key: 'matricula', width: 14 },
      { header: 'Alumno', key: 'alumno', width: 34 },
      { header: 'Concepto', key: 'concepto', width: 26 },
      { header: 'Periodo', key: 'periodo', width: 10 },
      { header: 'Vencimiento', key: 'vencimiento', width: 12 },
      { header: 'Total', key: 'total', width: 12 },
      { header: 'Pagado', key: 'pagado', width: 12 },
      { header: 'Saldo', key: 'saldo', width: 12 },
      { header: 'Estatus', key: 'estatus', width: 12 },
    ];
    ws.getRow(1).font = { bold: true };
    for (const c of adeudos) {
      ws.addRow({
        matricula: c.alumno.matricula,
        alumno: c.alumno.usuario.nombreCompleto,
        concepto: c.descripcion,
        periodo: c.periodo ?? '',
        vencimiento: c.fechaVencimiento ?? '',
        total: c.total,
        pagado: c.pagado,
        saldo: c.saldo,
        estatus: c.estatus,
      });
    }
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', contentDisposition('adeudos.xlsx', 'attachment'));
    await wb.xlsx.write(res);
    res.end();
  }
  /** Reporte privado de saldos y pagos; el alumno se valida por el JWT en el controlador. */
  async estadoCuentaPdf(alumnoId: number, user: JwtUser | undefined, res: Response) {
    const estado = await this.cargos.estadoDeCuenta(alumnoId, user);
    const institucion = (await this.configuracion.obtener()).nombreInstitucion;
    const dinero = (importe: number) => '$' + importe.toFixed(2) + ' MXN';
    const abonado = estado.cargos.reduce((total, cargo) => total + (cargo.pagado ?? 0), 0);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', contentDisposition(`estado-cuenta-${estado.alumno.matricula}.pdf`, 'attachment'));
    res.setHeader('Cache-Control', 'private, no-store');
    const doc = new PDFDocument({ margin: 44, size: 'LETTER' });
    doc.pipe(res);
    doc.font('Helvetica-Bold').fontSize(16).text(institucion, { align: 'center' });
    doc.font('Helvetica').fontSize(12).text('Estado de cuenta digital', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text(`Alumno: ${estado.alumno.usuario?.nombreCompleto ?? estado.alumno.matricula}`);
    doc.text(`Matrícula: ${estado.alumno.matricula}`);
    doc.text(`Fecha de emisión: ${new Date().toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City' })}`);
    doc.moveDown();
    doc.font('Helvetica-Bold').text(`Pagado aplicado: ${dinero(abonado)}`);
    doc.text(`Saldo pendiente: ${dinero(estado.saldoTotal)}`);
    doc.moveDown();
    doc.fontSize(11).text('Cargos y saldos');
    doc.font('Helvetica').fontSize(9);
    if (!estado.cargos.length) doc.text('No hay cargos registrados.');
    for (const cargo of estado.cargos) {
      doc.text(`#${cargo.id} | ${cargo.descripcion} | ${cargo.estatus}`);
      doc.text(`Vence: ${cargo.fechaVencimiento ?? 'Sin fecha'} | Total: ${dinero(cargo.total ?? 0)} | Pagado: ${dinero(cargo.pagado ?? 0)} | Saldo: ${dinero(cargo.saldo ?? 0)}`);
      doc.moveDown(0.45);
    }
    doc.moveDown();
    doc.font('Helvetica-Bold').fontSize(11).text('Movimientos de pago');
    doc.font('Helvetica').fontSize(9);
    if (!estado.pagos.length) doc.text('No hay pagos registrados.');
    for (const pago of estado.pagos) {
      doc.text(`#${pago.id} | ${new Date(pago.fechaPago).toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City' })} | ${dinero(pago.monto)} | ${pago.metodo} | ${pago.estatus} | ${pago.aplicado ? 'Aplicado' : 'Sin aplicar'}`);
    }
    doc.moveDown();
    doc.fontSize(8).text('Solo los pagos confirmados y aplicados disminuyen el saldo. Documento informativo, no comprobante fiscal.');
    doc.end();
  }

  async miEstadoCuentaPdf(user: JwtUser, res: Response) {
    const alumno = await this.alumnosService.obtenerPorUsuario(user.sub);
    return this.estadoCuentaPdf(alumno.id, undefined, res);
  }

  /** Fotografía actual de alumnos en BAJA; updatedAt no es una fecha certificada de baja. */
  async bajasExcel(user: JwtUser, res: Response, plantelId?: number) {
    const planteles = await this.scope.resolverFiltro(user, plantelId);
    const query = this.alumnos.createQueryBuilder('a')
      .innerJoinAndSelect('a.usuario', 'u')
      .innerJoinAndSelect('a.plantel', 'p')
      .where('a.estatus = :estatus', { estatus: 'BAJA' });
    if (planteles !== null) query.andWhere('a.plantel_id IN (:...planteles)', { planteles });
    const alumnos = await query.orderBy('a.id', 'ASC').take(5001).getMany();
    if (alumnos.length > 5000) throw new BadRequestException('El reporte supera 5000 registros; filtra por plantel');
    const libro = new ExcelJS.Workbook();
    const hoja = libro.addWorksheet('Bajas actuales');
    hoja.columns = [
      { header: 'Matrícula', key: 'matricula', width: 18 },
      { header: 'Alumno', key: 'nombre', width: 36 },
      { header: 'Plantel actual', key: 'plantel', width: 30 },
      { header: 'Estatus', key: 'estatus', width: 14 },
      { header: 'Última actualización (no fecha de baja)', key: 'actualizado', width: 38 },
    ];
    hoja.getRow(1).font = { bold: true };
    const fechaInstitucional = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit',
    });
    for (const alumno of alumnos) hoja.addRow({
      matricula: alumno.matricula, nombre: alumno.usuario.nombreCompleto,
      plantel: alumno.plantel.nombre, estatus: alumno.estatus,
      actualizado: fechaInstitucional.format(alumno.updatedAt),
    });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', contentDisposition('bajas-actuales.xlsx', 'attachment'));
    res.setHeader('Cache-Control', 'private, no-store');
    await libro.xlsx.write(res);
    res.end();
  }

  /** Serie de cobranza de los seis meses calendario, agregada por origen de pago. */
  async serieCobranza(user: JwtUser, plantelId?: number) {
    const planteles = await this.scope.resolverFiltro(user, plantelId);
    const mexico = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
    const [year, month] = mexico.slice(0, 7).split('-').map(Number);
    const meses = Array.from({ length: 6 }, (_, indice) => {
      const fecha = new Date(Date.UTC(year, month - 6 + indice, 1));
      const siguiente = new Date(Date.UTC(year, month - 5 + indice, 1));
      const inicio = fecha.toISOString().slice(0, 10);
      const fin = siguiente.toISOString().slice(0, 10);
      return { periodo: inicio.slice(0, 7), inicio, fin };
    });
    const datos = await Promise.all(meses.map(async (mes) => {
      const query = this.pagos.createQueryBuilder('p')
        .select('COALESCE(SUM(p.monto), 0)', 'total')
        .addSelect('COUNT(DISTINCT p.alumno_id)', 'alumnos')
        .where('p.estatus = :estatus', { estatus: 'CONFIRMADO' })
        .andWhere('p.fecha_pago >= :inicio AND p.fecha_pago < :fin', { inicio: mes.inicio, fin: mes.fin });
      if (planteles !== null) query.andWhere('p.plantel_id IN (:...planteles)', { planteles });
      const resultado = await query.getRawOne<{ total: string | number; alumnos: string | number }>();
      return { periodo: mes.periodo, cobrado: Math.round(Number(resultado?.total ?? 0) * 100) / 100,
        alumnosQuePagaron: Number(resultado?.alumnos ?? 0) };
    }));
    return { datos, moneda: 'MXN', base: 'Pagos confirmados por fecha de pago y plantel de origen' };
  }

}
