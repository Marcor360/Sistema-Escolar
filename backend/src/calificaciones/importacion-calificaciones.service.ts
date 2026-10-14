import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, LessThan } from 'typeorm';
import { randomUUID } from 'crypto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import * as ExcelJS from 'exceljs';
import { CalificacionesService } from './calificaciones.service';
import { CapturaCalificacionesDto } from './calificaciones.dto';
import { ContextoNotasDto } from './importacion-calificaciones.dto';
import { JwtUser } from '../common/current-user.decorator';
import { GrupoMateria, ImportacionPreview, ImportacionFila, Inscripcion, Usuario } from '../entities';
import { inscripcionVigente } from '../common/contexto-academico';
import { leerArchivo } from '../importaciones/lectura';
import { PreviewCifrado } from '../importaciones/preview-cifrado';
const CABECERAS = ['grupoMateriaId', 'parcial', 'alumnoId', 'matricula', 'grado', 'calificacion', 'observaciones', 'alumno'];
@Injectable()
export class ImportacionCalificacionesService {
  private readonly cifrado: PreviewCifrado;
  constructor(
    private readonly ds: DataSource,
    private readonly notas: CalificacionesService,
    config: ConfigService,
  ) {
    this.cifrado = new PreviewCifrado(config.getOrThrow<string>('JWT_SECRET'));
  }
  async plantilla(dto: ContextoNotasDto, user: JwtUser) {
    if (!Number.isInteger(dto.parcial) || dto.parcial < 0 || dto.parcial > 3) throw new BadRequestException('Selecciona un parcial del 1 al 3 o Final');
    await this.notas.estadoPeriodo(dto.grupoMateriaId, dto.parcial, user);
    const gm = await this.ds.getRepository(GrupoMateria).findOneByOrFail({ id: dto.grupoMateriaId });
    const inscripciones = await this.ds
      .getRepository(Inscripcion)
      .find({ where: { ...inscripcionVigente, grupoId: gm.grupoId }, order: { alumnoId: 'ASC' } });
    if (inscripciones.length > 500) throw new BadRequestException('La plantilla supera 500 inscritos; solicita una exportación por lotes');
    const libro = new ExcelJS.Workbook(),
      hoja = libro.addWorksheet('CALIFICACIONES');
    hoja.addRow(CABECERAS);
    hoja.getRow(1).font = { bold: true };
    for (const i of inscripciones)
      hoja.addRow([gm.id, dto.parcial, i.alumnoId, i.alumno.matricula, gm.grupo.grado ?? '', '', '', i.alumno.usuario.nombreCompleto]);
    for (let fila = 2; fila <= Math.max(inscripciones.length + 1, 2); fila++) hoja.getCell(`F${fila}`).dataValidation = { type: 'decimal', operator: 'between', formulae: [0, 100], allowBlank: true, showErrorMessage: true, errorTitle: 'Calificación inválida', error: 'Usa un número entre 0 y 100.' };
    hoja.columns.forEach((c) => {
      c.width = 22;
    });
    const ayuda = libro.addWorksheet('Instrucciones');
    ayuda.addRows([
      [
        `Plantel: ${gm.grupo.plantel.nombre}; ciclo: ${gm.grupo.ciclo.clave}; grupo: ${gm.grupo.nombre}; materia: ${gm.materia.clave}`,
      ],
      ['Parcial 0 = Final; 1, 2 y 3 forman el promedio oficial.'],
      ['Conserva identificadores. Elimina filas pendientes; una nota vacía no equivale a cero.'],
      ['Captura 0–100 con hasta dos decimales. Para corregir, indica motivo en la pantalla.'],
    ]);
    return Buffer.from(await libro.xlsx.writeBuffer());
  }
  async preview(dto: ContextoNotasDto, buffer: Buffer, nombre: string, user: JwtUser) {
    // Autorización previa a mostrar diferencias o validar identificadores.
    await this.notas.estadoPeriodo(dto.grupoMateriaId, dto.parcial, user);
    const filas = await leerArchivo(buffer, nombre),
      errores: { fila: number; mensaje: string }[] = [];
    const gm = await this.ds.getRepository(GrupoMateria).findOneByOrFail({ id: dto.grupoMateriaId });
    const inscritos = await this.ds
      .getRepository(Inscripcion)
      .find({ where: { ...inscripcionVigente, grupoId: gm.grupoId } });
    const alumnos = new Map(inscritos.map((i) => [i.alumnoId, i.alumno.matricula]));
    const vistos = new Set<number>();
    const items: CapturaCalificacionesDto['items'] = [];
    for (let i = 0; i < filas.length; i++) {
      const f = filas[i],
        id = Number(f.alumnoId);
      let mensaje = '';
      if (Object.keys(f).some((k) => !CABECERAS.includes(k))) mensaje = 'Columnas no admitidas; usa la plantilla.';
      else if (String(dto.grupoMateriaId) !== f.grupoMateriaId || String(dto.parcial) !== f.parcial)
        mensaje = 'Clase o parcial distintos de los seleccionados.';
      else if (
        !Number.isSafeInteger(id) ||
        !alumnos.has(id) ||
        alumnos.get(id) !== f.matricula ||
        (gm.grupo.grado ?? '') !== (f.grado ?? '')
      )
        mensaje = 'Identificador, matrícula o grado no corresponden a una inscripción activa.';
      else if (vistos.has(id)) mensaje = 'Alumno duplicado en el archivo.';
      else if (!/^(?:\d+|\d*\.\d{1,2})$/.test(f.calificacion) || Number(f.calificacion) > 100)
        mensaje = 'Calificación requerida entre 0 y 100, hasta dos decimales.';
      else if ((f.observaciones ?? '').length > 300) mensaje = 'Observaciones: máximo 300 caracteres.';
      vistos.add(id);
      if (mensaje) errores.push({ fila: i + 2, mensaje });
      else
        items.push({
          alumnoId: id,
          calificacion: Number(f.calificacion),
          ...(f.observaciones ? { observaciones: f.observaciones } : {}),
        });
    }
    if (errores.length) return { previewId: null, registros: filas.length, errores, diferencias: [] };
    const captura = plainToInstance(CapturaCalificacionesDto, {
      grupoMateriaId: dto.grupoMateriaId,
      parcial: dto.parcial,
      motivo: dto.motivo,
      items,
    });
    if ((await validate(captura)).length) throw new BadRequestException('Captura inválida');
    return this.ds.transaction(async (manager) => {
      const resultado = await this.notas.capturarEnTransaccion(captura, user, manager, true);
      // Serializa la cuota por actor; comparte límites con las otras importaciones.
      await manager
        .getRepository(Usuario)
        .findOne({ where: { id: user.sub }, loadEagerRelations: false, lock: { mode: 'pessimistic_write' } });
      const previews = manager.getRepository(ImportacionPreview);
      await previews.delete({ expira: LessThan(new Date()) });
      if ((await previews.count()) >= 100 || (await previews.countBy({ actorId: user.sub })) >= 5)
        throw new BadRequestException('Confirma tus previews pendientes o espera 15 minutos.');
      const p = previews.create({
        id: randomUUID(),
        tipo: 'CALIFICACIONES',
        actorId: user.sub,
        expira: new Date(Date.now() + 900000),
      });
      await previews.insert(p);
      const detalles = items.map((item, posicion) => ({
        previewId: p.id,
        posicion,
        contenido: this.cifrado.cifrar(
          {
            grupoMateriaId: String(captura.grupoMateriaId),
            parcial: String(captura.parcial),
            motivo: captura.motivo ?? '',
            alumnoId: String(item.alumnoId),
            calificacion: String(item.calificacion),
            observaciones: item.observaciones ?? '',
            revision: resultado.revisiones.find((r) => r.alumnoId === item.alumnoId)!.revision,
          },
          `${p.id}:${p.actorId}:CALIFICACIONES:${posicion}`,
        ),
      }));
      for (let i = 0; i < detalles.length; i += 100)
        await manager.getRepository(ImportacionFila).insert(detalles.slice(i, i + 100));
      return {
        previewId: p.id,
        registros: items.length,
        errores,
        diferencias: resultado.diferencias,
        sinCambios: resultado.sinCambios,
      };
    });
  }
  async confirmar(id: string, confirmado: boolean, user: JwtUser) {
    if (!confirmado) throw new BadRequestException('Confirma explícitamente el lote.');
    return this.ds.transaction('SERIALIZABLE', async (manager) => {
      const p = await manager
        .getRepository(ImportacionPreview)
        .findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!p || p.tipo !== 'CALIFICACIONES' || p.actorId !== user.sub || p.expira <= new Date())
        throw new NotFoundException('Preview no disponible, consumido o expirado.');
      const filas = await manager
        .getRepository(ImportacionFila)
        .find({ where: { previewId: id }, order: { posicion: 'ASC' } });
      if (!filas.length || filas.length > 500) throw new ConflictException('Preview inválido.');
      let datos: Record<string, string>[];
      try { datos = filas.map((f) => this.cifrado.descifrar(f.contenido, `${p.id}:${p.actorId}:CALIFICACIONES:${f.posicion}`)); }
      catch { throw new ConflictException('Preview alterado o clave cambiada; genera otra previsualización'); }
      const primero = datos[0];
      const dto = plainToInstance(CapturaCalificacionesDto, {
        grupoMateriaId: Number(primero.grupoMateriaId),
        parcial: Number(primero.parcial),
        motivo: primero.motivo,
        items: datos.map((f) => ({
          alumnoId: Number(f.alumnoId),
          calificacion: Number(f.calificacion),
          ...(f.observaciones ? { observaciones: f.observaciones } : {}),
        })),
      });
      if (
        (await validate(dto)).length ||
        datos.some(
          (f) =>
            f.grupoMateriaId !== primero.grupoMateriaId || f.parcial !== primero.parcial || f.motivo !== primero.motivo,
        )
      )
        throw new ConflictException('Preview inválido.');
      const resultado = await this.notas.capturarEnTransaccion(
        dto,
        user,
        manager,
        false,
        new Map(datos.map((f) => [Number(f.alumnoId), f.revision])),
      );
      await manager.getRepository(ImportacionPreview).delete(id);
      return resultado;
    });
  }
}
