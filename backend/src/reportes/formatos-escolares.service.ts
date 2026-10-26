import { basename, join } from 'path';
import { readFile } from 'fs/promises';
import { uploadsPath } from '../common/uploads-path';
import type { LogoDocumento } from './formatos-escolares.xlsx';
import { boletaPublicable } from './publicacion-boleta';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import PDFDocument from 'pdfkit';
import { Alumno } from '../entities/alumno.entity';
import { Inscripcion } from '../entities/inscripcion.entity';
import { GrupoMateria } from '../entities/grupo-materia.entity';
import { Calificacion } from '../entities/calificacion.entity';
import { PeriodoCalificacion } from '../entities/periodo-calificacion.entity';
import { ReportesService } from './reportes.service';
import { AlumnosService } from '../alumnos/alumnos.service';
import { ScopeService } from '../planteles/scope.service';
import { ConfiguracionService } from '../configuracion/configuracion.service';
import { JwtUser } from '../common/current-user.decorator';
import { promedioOficial } from '../common/promedio-oficial';
import { crearActaExcel, crearBoletaExcel } from './formatos-escolares.xlsx';

@Injectable()
export class FormatosEscolaresService {
  constructor(private readonly ds: DataSource, private readonly reportes: ReportesService,
    private readonly alumnos: AlumnosService, private readonly scope: ScopeService,
    private readonly marca: ConfiguracionService) {}

  private async logo():Promise<LogoDocumento|undefined> {
    const marca=await this.marca.obtener();
    if(!marca.logoUrl || !/^\/uploads\/[A-Za-z0-9._-]+\.(png|jpe?g)$/i.test(marca.logoUrl))return undefined;
    try {return {buffer:await readFile(join(uploadsPath(),basename(marca.logoUrl))),extension:/\.png$/i.test(marca.logoUrl)?'png':'jpeg'};}
    catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return undefined;throw error;}
  }

  async acta(id: number, parcial: number, user: JwtUser) {
    if (!Number.isInteger(parcial) || parcial < 0 || parcial > 3) throw new BadRequestException('Selecciona P1, P2, P3 o Final');
    const gm = await this.reportes.validarAccesoAClase(id, user);
    const [inscritos, notas, periodo, marca] = await Promise.all([
      this.ds.getRepository(Inscripcion).find({ where: { grupoId: gm.grupoId, estatus: 'ACTIVA', alumno: { estatus: 'ACTIVO' } } }),
      this.ds.getRepository(Calificacion).find({ where: { grupoMateriaId: id, parcial } }),
      this.ds.getRepository(PeriodoCalificacion).findOneBy({ grupoMateriaId: id, parcial }),
      this.marca.obtener(),
    ]);
    const porAlumno = new Map(notas.map(n => [n.alumnoId, n]));
    const filas = inscritos.map(i => ({ alumnoId: i.alumnoId, matricula: i.alumno.matricula,
      nombre: [i.alumno.usuario.apellidoPaterno, i.alumno.usuario.apellidoMaterno, i.alumno.usuario.nombre].filter(Boolean).join(' '),
      calificacion: porAlumno.has(i.alumnoId) ? Number(porAlumno.get(i.alumnoId)!.calificacion) : null,
      observaciones: porAlumno.get(i.alumnoId)?.observaciones ?? '',
    })).sort((a,b) => a.nombre.localeCompare(b.nombre, 'es') || a.matricula.localeCompare(b.matricula, 'es'));
    return { institucion: marca.nombreInstitucion, claseId: id, parcial,
      evaluacion: parcial === 0 ? 'Final' : `Parcial ${parcial}`, escala: '0–100 (sin conversión)',
      plantel: gm.grupo.plantel.nombre, plan: gm.grupo.carrera?.nombre ?? '',
      periodo: gm.grupo.periodoAcademico?.nombre ?? gm.grupo.grado ?? '',
      ciclo: gm.grupo.ciclo.clave, grupo: gm.grupo.nombre, asignatura: gm.materia.nombre,
      docente: gm.docente?.usuario.nombreCompleto ?? '', estado: periodo?.estatus ?? 'ABIERTO',
      faltantes: filas.filter(f => f.calificacion === null).length,
      aviso: 'La asistencia diaria, faltas, evaluación continua y examen desglosado no se registran actualmente; sus casillas se dejan vacías. La calificación parcial se captura directamente, sin fórmula nueva.', filas };
  }

  async actaExcel(id: number, parcial: number, user: JwtUser, plantilla: boolean) {
    return crearActaExcel(await this.acta(id, parcial, user), plantilla, await this.logo());
  }

  async boleta(alumnoId: number, user: JwtUser, inscripcionId?: number, cicloId?: number) {
    if (user.roles.includes('ALUMNO')) {
      const propio = await this.alumnos.obtenerPorUsuario(user.sub);
      if (propio.id !== alumnoId) throw new ForbiddenException('No puedes consultar la boleta de otro alumno');
    } else if (!user.roles.some(r => ['ADMINISTRATIVO','SUPERADMIN'].includes(r))) {
      throw new ForbiddenException('La boleta completa es exclusiva del alumno y Control Escolar');
    }
    const alumno = await this.ds.getRepository(Alumno).findOneBy({ id: alumnoId });
    if (!alumno) throw new NotFoundException('Alumno no encontrado');
    const inscripciones = await this.ds.getRepository(Inscripcion).find({
      where: { alumnoId, ...(inscripcionId ? { id: inscripcionId } : {}),
        ...(cicloId ? { grupo: { cicloId } } : inscripcionId ? {} : { grupo: { ciclo: { activo: true } } }) },
      relations: ['grupo.carrera', 'grupo.periodoAcademico'], order: { id: 'DESC' },
    });
    if (!inscripciones.length) throw new NotFoundException('No hay inscripción en el contexto seleccionado');
    if (inscripciones.length !== 1) throw new BadRequestException('Selecciona la inscripción de la boleta');
    const inscripcion = inscripciones[0], grupo = inscripcion.grupo;
    if (!user.roles.includes('ALUMNO')) await this.scope.validarGestion(user, grupo.plantelId);
    const [clases, notas, periodos, marca] = await Promise.all([
      this.ds.getRepository(GrupoMateria).find({ where: { grupoId: grupo.id }, order: { id: 'ASC' } }),
      this.ds.getRepository(Calificacion).find({ where: { alumnoId, grupoMateria: { grupoId: grupo.id } } }),
      this.ds.getRepository(PeriodoCalificacion).find({ where: { grupoMateria: { grupoId: grupo.id } } }),
      this.marca.obtener(),
    ]);
    const filas = clases.map(gm => {
      const registros = notas.filter(n => n.grupoMateriaId === gm.id);
      return { clave: gm.materia.clave, asignatura: gm.materia.nombre, creditos: Number(gm.materia.creditos),
        seriacion: '', ciclo: grupo.ciclo.clave, promedioFinal: promedioOficial(new Map(registros.map(n=>[n.parcial,Number(n.calificacion)]))),
        observaciones: registros.find(n=>n.parcial === 3)?.observaciones ?? '' };
    });
    // No se publica una boleta parcial ni se promedian solo las materias disponibles.
    const disponible = boletaPublicable(clases,notas,periodos);
    const promedioGeneral = disponible ? Math.round(filas.reduce((s,f)=>s + Number(f.promedioFinal),0) / filas.length * 10) / 10 : null;
    const ocultar = user.roles.includes('ALUMNO') && !disponible;
    return { institucion: marca.nombreInstitucion, alumno: alumno.usuario.nombreCompleto, matricula: alumno.matricula,
      alumnoId, inscripcionId: inscripcion.id, plantel: grupo.plantel.nombre, plan: grupo.carrera?.nombre ?? '',
      periodo: grupo.periodoAcademico?.nombre ?? grupo.grado ?? '', ciclo: grupo.ciclo.clave, grupo: grupo.nombre,
      disponible, estado: disponible ? 'DISPONIBLE' : 'PENDIENTE', escala: '0–100 (sin conversión)',
      aviso: 'Formato informativo. Promedio vigente de P1–P3; Final permanece independiente. Seriación sin registro: casilla vacía. Sin firma ni sello digital.',
      filas: ocultar ? [] : filas, promedioGeneral: ocultar ? null : promedioGeneral };
  }

  async miBoleta(user: JwtUser, inscripcionId?: number, cicloId?: number) {
    const alumno = await this.alumnos.obtenerPorUsuario(user.sub);
    return this.boleta(alumno.id, user, inscripcionId, cicloId);
  }

  async boletaExcel(alumnoId: number, user: JwtUser, inscripcionId?: number, cicloId?: number) {
    const datos = await this.boleta(alumnoId,user,inscripcionId,cicloId);
    if (user.roles.includes('ALUMNO') && !datos.disponible) throw new ConflictException('La boleta estará disponible cuando Control Escolar cierre P1–P3 completos');
    return crearBoletaExcel(datos,await this.logo());
  }

  async boletaPdf(alumnoId: number, user: JwtUser, inscripcionId?: number, cicloId?: number): Promise<Buffer> {
    const datos = await this.boleta(alumnoId,user,inscripcionId,cicloId);
    if (user.roles.includes('ALUMNO') && !datos.disponible) throw new ConflictException('La boleta estará disponible cuando Control Escolar cierre P1–P3 completos');
    const doc = new PDFDocument({ margin: 36, size: 'LETTER' }), partes: Buffer[] = [];
    const resultado = new Promise<Buffer>((resolve,reject) => { doc.on('data',(b: Buffer)=>partes.push(b)); doc.on('end',()=>resolve(Buffer.concat(partes))); doc.on('error',reject); });
    doc.registerFont('Escolar',join(__dirname,'assets','OnestVariable.ttf'));
    const logo=await this.logo();
    if(logo){doc.image(logo.buffer,36,36,{fit:[65,58]});doc.x=115;}
    doc.font('Escolar').fontSize(16).text(datos.institucion,{ align:'center' });
    doc.fontSize(12).text('BOLETA INFORMATIVA DE CALIFICACIONES FINALES',{ align:'center' });
    doc.y=Math.max(doc.y,100);doc.x=36;
    doc.moveDown().font('Escolar').fontSize(10);
    for (const linea of [`PLANTEL: ${datos.plantel}`,`PLAN DE ESTUDIOS: ${datos.plan}`,`NOMBRE DEL ALUMNO: ${datos.alumno}`,`MATRÍCULA: ${datos.matricula}`,`CUATRIMESTRE/PERIODO: ${datos.periodo} · CICLO ESCOLAR: ${datos.ciclo}`,`GRUPO: ${datos.grupo} · ESCALA: ${datos.escala}`, ...(datos.disponible ? [] : ['BORRADOR — CAPTURA O CIERRE PENDIENTE'])]) doc.text(linea);
    doc.moveDown();
    const widths = [24,43,170,48,43,62,55,95], headers=['N°','Clave','Asignatura','Créditos','Seriación','Ciclo escolar','Prom. final','Observaciones'];
    // 540 puntos disponibles en carta; la tabla no se recorta al imprimir.
    const row = (values: string[], bold = false) => {
      doc.font('Escolar').fontSize(bold?8.5:8);
      const h = Math.max(24,...values.map((v,i)=>doc.heightOfString(v,{width:widths[i]-6})+8));
      if (doc.y + h > 680) { doc.addPage(); row(headers,true); }
      const y=doc.y; let x=36;
      values.forEach((v,i)=>{ doc.rect(x,y,widths[i],h).stroke();doc.text(v,x+3,y+4,{width:widths[i]-6});x+=widths[i]; });
      doc.y=y+h;doc.x=36;
    };
    row(headers,true);
    for(const [indice,f] of datos.filas.entries()) row([String(indice + 1),f.clave,f.asignatura,f.creditos.toFixed(2),f.seriacion,f.ciclo,f.promedioFinal == null?'':String(f.promedioFinal),f.observaciones]);
    doc.moveDown().font('Escolar').text(`PROMEDIO GENERAL: ${datos.promedioGeneral ?? 'Pendiente'}`);
    doc.moveDown().font('Escolar').fontSize(8).text(datos.aviso);
    doc.moveDown(3).text('____________________________________________________________',{align:'center'});
    doc.text('SELLO Y FIRMA DEL COORDINADOR DE SERVICIOS ESCOLARES',{align:'center'});
    doc.end();return resultado;
  }
}
export type DatosActa = Awaited<ReturnType<FormatosEscolaresService['acta']>>;
export type DatosBoleta = Awaited<ReturnType<FormatosEscolaresService['boleta']>>;
