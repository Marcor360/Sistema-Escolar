import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
    private readonly config: ConfigService,
  ) {}

  /** Contadores para el dashboard. */
  async resumen() {
    const [alumnosActivos, docentesActivos, totalGrupos] = await Promise.all([
      this.alumnos.count({ where: { estatus: 'ACTIVO' } }),
      this.docentesRepo.count({ where: { estatus: 'ACTIVO' } }),
      this.grupos.count(),
    ]);
    const adeudos = await this.cargos.adeudos();
    const saldoPendiente = Math.round(adeudos.reduce((s, c) => s + c.saldo, 0) * 100) / 100;

    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);
    const pagosMes = await this.pagos
      .createQueryBuilder('p')
      .select('COALESCE(SUM(p.monto), 0)', 'total')
      .where('p.estatus = :e', { e: 'CONFIRMADO' })
      .andWhere('p.fecha_pago >= :d', { d: inicioMes })
      .getRawOne<{ total: string }>();

    return {
      alumnosActivos,
      docentesActivos,
      grupos: totalGrupos,
      saldoPendiente,
      cargosConAdeudo: adeudos.length,
      cobradoMes: Number(pagosMes?.total ?? 0),
    };
  }

  /** El maestro solo exporta sus clases; ADMINISTRATIVO y SUPERADMIN, cualquiera. */
  private async validarAccesoAClase(grupoMateriaId: number, user: JwtUser): Promise<GrupoMateria> {
    const gm = await this.grupoMaterias.findOne({ where: { id: grupoMateriaId } });
    if (!gm) throw new NotFoundException('Grupo-materia no encontrado');
    if (user.roles.includes('SUPERADMIN') || user.roles.includes('ADMINISTRATIVO')) return gm;
    const docente = await this.docentes.obtenerPorUsuario(user.sub);
    if (gm.docenteId !== docente.id) {
      throw new ForbiddenException('La materia no está asignada a este docente');
    }
    return gm;
  }

  /** Concentrado de calificaciones de una clase (parciales, final y promedio) en Excel. */
  async calificacionesExcel(grupoMateriaId: number, user: JwtUser, res: Response) {
    const gm = await this.validarAccesoAClase(grupoMateriaId, user);
    const registros = await this.calificaciones.find({
      where: { grupoMateriaId },
      order: { alumnoId: 'ASC', parcial: 'ASC' },
    });

    // Pivote: una fila por alumno, columnas por parcial
    const filas = new Map<number, { matricula: string; nombre: string; parciales: Map<number, number> }>();
    for (const r of registros) {
      const fila = filas.get(r.alumnoId) ?? {
        matricula: r.alumno.matricula,
        nombre: r.alumno.usuario.nombreCompleto,
        parciales: new Map<number, number>(),
      };
      fila.parciales.set(r.parcial, r.calificacion);
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
      { header: 'Final', key: 'final', width: 11 },
      { header: 'Promedio', key: 'promedio', width: 11 },
    ];
    ws.getRow(1).font = { bold: true };

    for (const fila of filas.values()) {
      const valores = [1, 2, 3].map((p) => fila.parciales.get(p));
      const definidos = valores.filter((v): v is number => v !== undefined);
      const promedio = definidos.length
        ? Math.round((definidos.reduce((a, b) => a + b, 0) / definidos.length) * 10) / 10
        : null;
      ws.addRow({
        matricula: fila.matricula,
        nombre: fila.nombre,
        p1: valores[0] ?? '',
        p2: valores[1] ?? '',
        p3: valores[2] ?? '',
        final: fila.parciales.get(0) ?? '',
        promedio: promedio ?? '',
      });
    }

    const nombre = `calificaciones-${gm.grupo.nombre}-${gm.materia.clave}.xlsx`.replace(/\s+/g, '_');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${nombre}`);
    await wb.xlsx.write(res);
    res.end();
  }

  /** Boleta PDF básica: calificaciones por materia y parcial + promedios. */
  async boletaPdf(alumnoId: number, res: Response) {
    const alumno = await this.alumnos.findOne({ where: { id: alumnoId } });
    if (!alumno) throw new NotFoundException('Alumno no encontrado');
    const calificaciones = await this.calificaciones.find({
      where: { alumnoId },
      order: { grupoMateriaId: 'ASC', parcial: 'ASC' },
    });

    const materias = new Map<number, { nombre: string; parciales: Map<number, number> }>();
    for (const c of calificaciones) {
      const fila = materias.get(c.grupoMateriaId) ?? {
        nombre: c.grupoMateria?.materia?.nombre ?? `Materia ${c.grupoMateriaId}`,
        parciales: new Map<number, number>(),
      };
      fila.parciales.set(c.parcial, c.calificacion);
      materias.set(c.grupoMateriaId, fila);
    }

    const institucion = this.config.get<string>('NOMBRE_INSTITUCION') || 'Institución Educativa';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=boleta-${alumno.matricula}.pdf`);

    const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
    doc.pipe(res);

    doc.fontSize(16).font('Helvetica-Bold').text(institucion, { align: 'center' });
    doc.fontSize(12).font('Helvetica').text('Boleta de calificaciones', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10);
    doc.text(`Alumno: ${alumno.usuario.nombreCompleto}`);
    doc.text(`Matrícula: ${alumno.matricula}`);
    doc.text(`Fecha de emisión: ${new Date().toLocaleDateString('es-MX')}`);
    doc.moveDown();

    const x = 50;
    let y = doc.y;
    const anchos = [220, 70, 70, 70, 80];
    const encabezados = ['Materia', 'Parcial 1', 'Parcial 2', 'Parcial 3', 'Promedio'];
    doc.font('Helvetica-Bold');
    encabezados.forEach((h, i) => {
      doc.text(h, x + anchos.slice(0, i).reduce((a, b) => a + b, 0), y, { width: anchos[i] });
    });
    doc.font('Helvetica');
    y += 18;
    doc.moveTo(x, y - 4).lineTo(x + anchos.reduce((a, b) => a + b, 0), y - 4).stroke();

    const promediosGenerales: number[] = [];
    for (const fila of materias.values()) {
      const valores = [1, 2, 3].map((p) => fila.parciales.get(p));
      const definidos = valores.filter((v): v is number => v !== undefined);
      const promedio = definidos.length
        ? Math.round((definidos.reduce((a, b) => a + b, 0) / definidos.length) * 10) / 10
        : null;
      if (promedio !== null) promediosGenerales.push(promedio);

      const celdas = [
        fila.nombre,
        ...valores.map((v) => (v === undefined ? '—' : v.toFixed(1))),
        promedio === null ? '—' : promedio.toFixed(1),
      ];
      celdas.forEach((c, i) => {
        doc.text(String(c), x + anchos.slice(0, i).reduce((a, b) => a + b, 0), y, { width: anchos[i] });
      });
      y += 16;
      if (y > 700) { doc.addPage(); y = 60; }
    }

    doc.moveDown(2);
    const promedioGeneral = promediosGenerales.length
      ? (promediosGenerales.reduce((a, b) => a + b, 0) / promediosGenerales.length).toFixed(1)
      : '—';
    doc.font('Helvetica-Bold').text(`Promedio general: ${promedioGeneral}`, x, y + 10);
    doc.end();
  }

  /** Reporte de adeudos en Excel. */
  async adeudosExcel(res: Response) {
    const adeudos = await this.cargos.adeudos();

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
    res.setHeader('Content-Disposition', 'attachment; filename=adeudos.xlsx');
    await wb.xlsx.write(res);
    res.end();
  }
}
