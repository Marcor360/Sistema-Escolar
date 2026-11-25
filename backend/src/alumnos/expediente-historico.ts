import { EntityManager, In } from 'typeorm';
import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
import { Asistencia, Entrega, BoletaRespuesta, Cargo, Pago, EgresoDocumento } from '../entities';
import { rutaOficial } from '../boletas/boleta-oficial';
import { GrupoMateria } from '../entities/grupo-materia.entity';
import { EgresoAlumno } from '../entities/egreso-alumno.entity';
import { Inscripcion } from '../entities/inscripcion.entity';
import { Calificacion } from '../entities/calificacion.entity';
import { HistorialCalificacion } from '../entities/historial-calificacion.entity';
import { ParticipacionAsignatura } from '../entities/participacion-asignatura.entity';
import { CalificacionRecursamiento, HistorialRecursamiento } from '../entities/calificacion-recursamiento.entity';

export async function expedienteHistorico(manager: EntityManager, egreso: EgresoAlumno, adjuntos: boolean) {
  const alumno = egreso.alumno;
  const inscripciones = await manager.getRepository(Inscripcion).find({
    where: { alumnoId: alumno.id },
    order: { id: 'ASC' },
  });
  const calificaciones = await manager.getRepository(Calificacion).find({
    where: { alumnoId: alumno.id },
    order: { id: 'ASC' },
  });
  const revisiones = await manager.getRepository(HistorialCalificacion).find({
    where: { alumnoId: alumno.id },
    order: { id: 'ASC' },
  });
  const participaciones = await manager.getRepository(ParticipacionAsignatura).find({
    where: { alumnoId: alumno.id },
    order: { id: 'ASC' },
  });
  const participacionIds = participaciones.map((p) => p.id);
  const notasRecursamiento = participacionIds.length
    ? await manager.getRepository(CalificacionRecursamiento).find({
        where: { participacionId: In(participacionIds) },
        order: { id: 'ASC' },
      })
    : [];
  const revisionesRecursamiento = participacionIds.length
    ? await manager.getRepository(HistorialRecursamiento).find({
        where: { participacionId: In(participacionIds) },
        order: { id: 'ASC' },
      })
    : [];

  const claseIds = [
    ...new Set([
      ...calificaciones.map((c) => c.grupoMateriaId),
      ...revisiones.map((r) => r.grupoMateriaId),
      ...participaciones.map((p) => p.grupoMateriaId),
    ]),
  ];
  const clases = claseIds.length
    ? await manager.getRepository(GrupoMateria).find({
        where: { id: In(claseIds) },
        relations: { materia: true },
        loadEagerRelations: false,
      })
    : [];
  const regimenes = new Map(clases.map((c) => [c.id, c.regimenEvaluacion]));
  const clasesRecursadas = new Map(participaciones.map((p) => [p.id, p.grupoMateriaId]));
  const documentos = await manager.getRepository(EgresoDocumento).find({
    where: { egresoId: egreso.id },
    order: { id: 'ASC' },
    select: {
      id: true,
      actorId: true,
      tipo: true,
      detalle: true,
      contexto: true,
      sha256: true,
      createdAt: true,
      mime: true,
      contenido: adjuntos,
      instantanea: adjuntos,
    },
  });
  for (const d of documentos)
    if (adjuntos && createHash('sha256').update(Buffer.from(d.contenido, 'base64')).digest('hex') !== d.sha256)
      throw new Error('Evidencia con huella inconsistente');
  const cargos = await manager.getRepository(Cargo).find({
    where: { alumnoId: alumno.id },
    order: { id: 'ASC' },
    loadEagerRelations: false,
    select: {
      id: true,
      plantelId: true,
      descripcion: true,
      cicloId: true,
      periodo: true,
      monto: true,
      descuento: true,
      recargo: true,
      fechaVencimiento: true,
      estatus: true,
    },
  });
  const pagos = await manager.getRepository(Pago).find({
    where: { alumnoId: alumno.id },
    order: { id: 'ASC' },
    loadEagerRelations: false,
    select: {
      id: true,
      plantelId: true,
      cargoId: true,
      monto: true,
      metodo: true,
      estatus: true,
      fechaPago: true,
    },
  });
  const asistencias = await manager
    .getRepository(Asistencia)
    .find({ where: { alumnoId: alumno.id }, order: { id: 'ASC' }, loadEagerRelations: false });
  const entregas = await manager
    .getRepository(Entrega)
    .find({
      where: { alumnoId: alumno.id },
      order: { id: 'ASC' },
      loadEagerRelations: false,
      relations: { actividad: true },
    });
  const respuestas = inscripciones.length
    ? await manager
        .getRepository(BoletaRespuesta)
        .find({ where: { inscripcionId: In(inscripciones.map((i) => i.id)) }, order: { id: 'ASC' } })
    : [];
  const boletas = [];
  for (const r of respuestas) {
    const inscripcion = inscripciones.find((i) => i.id === r.inscripcionId)!;
    const pdf = adjuntos && r.archivoOficial ? await readFile(rutaOficial(inscripcion, r.archivoOficial)) : null;
    boletas.push({
      id: r.id,
      inscripcionId: r.inscripcionId,
      estado: r.estado,
      firmante: r.firmanteNombre,
      fecha: r.createdAt,
      version: r.versionHash,
      calificaciones: r.snapshotJson,
      comentario: r.comentario,
      archivoOficial: r.archivoOficial,
      ...(pdf ? { pdf: pdf.toString('base64'), sha256: createHash('sha256').update(pdf).digest('hex') } : {}),
    });
  }
  return {
    esquema: 'expediente-egreso-iua/v3',
    exportadoEn: new Date().toISOString(),
    egreso: {
      id: egreso.id,
      cicloId: egreso.cicloId,
      cicloClave: egreso.ciclo.clave,
      fechaEgreso: egreso.fechaEgreso,
      finalizadoEn: egreso.finalizadoEn,
      archivarDesde: egreso.archivarDesde,
      fechaDocumental: egreso.fechaDocumental ?? null,
    },
    alumno: {
      id: alumno.id,
      matricula: alumno.matricula,
      curp: alumno.curp,
      plantelId: alumno.plantelId,
      fechaNacimiento: alumno.fechaNacimiento,
      estatus: alumno.estatus,
      nombre: alumno.usuario.nombre,
      segundoNombre: alumno.usuario.segundoNombre,
      apellidoPaterno: alumno.usuario.apellidoPaterno,
      apellidoMaterno: alumno.usuario.apellidoMaterno,
    },
    inscripciones: inscripciones.map((i) => ({
      id: i.id,
      grupoId: i.grupoId,
      grupo: i.grupo.nombre,
      plantelId: i.grupo.plantelId,
      plan: i.grupo.carreraId,
      cicloId: i.grupo.cicloId,
      fechaInscripcion: i.fechaInscripcion,
      estatus: i.estatus,
    })),
    materias: clases.map((c) => ({
      claseId: c.id,
      grupoId: c.grupoId,
      clave: c.materia.clave,
      nombre: c.materia.nombre,
      creditos: c.materia.creditos,
    })),
    asistencias,
    entregas: entregas.map((e) => ({
      actividad: e.actividad.titulo,
      claseId: e.actividad.grupoMateriaId,
      fecha: e.fechaEntregado,
      archivo: e.archivoNombre,
      respuesta: e.respuestaTexto,
      estado: e.estatus,
      calificacion: e.calificacion,
      escala: e.escalaMaxima,
      comentario: e.comentarioDocente,
    })),
    documentos,
    cargos,
    pagos,
    boletas,
    regimenesEvaluacion: clases.map((c) => ({ grupoMateriaId: c.id, regimenEvaluacion: c.regimenEvaluacion })),
    calificaciones: calificaciones.map((c) => ({
      id: c.id,
      grupoMateriaId: c.grupoMateriaId,
      parcial: c.parcial,
      calificacion: c.calificacion,
      escalaMaxima: c.escalaMaxima ?? 100,
      capturadaPorId: c.capturadaPorId,
      regimenEvaluacion: regimenes.get(c.grupoMateriaId) ?? null,
      observaciones: c.observaciones,
      updatedAt: c.updatedAt,
    })),
    revisiones: revisiones.map((r) => ({
      id: r.id,
      calificacionId: r.calificacionId,
      grupoMateriaId: r.grupoMateriaId,
      parcial: r.parcial,
      valorAnterior: r.valorAnterior,
      valorNuevo: r.valorNuevo,
      escalaAnterior: r.escalaAnterior ?? 100,
      escalaNueva: r.escalaNueva ?? 100,
      detalleCalculo: r.detalleCalculo ?? null,
      usuarioId: r.usuarioId,
      observacionAnterior: r.observacionAnterior,
      observacionNueva: r.observacionNueva,
      regimenEvaluacion: regimenes.get(r.grupoMateriaId) ?? null,
      motivo: r.motivo,
      fecha: r.fecha,
    })),
    recursamientos: participaciones.map((p) => ({
      id: p.id,
      grupoMateriaId: p.grupoMateriaId,
      intento: p.intento,
      regimenEvaluacion: regimenes.get(p.grupoMateriaId) ?? null,
      estado: p.estado,
    })),
    notasRecursamiento: notasRecursamiento.map((n) => ({
      participacionId: n.participacionId,
      parcial: n.parcial,
      calificacion: n.calificacion,
      escalaMaxima: n.escalaMaxima ?? 100,
      capturadaPorId: n.capturadaPorId,
      regimenEvaluacion: regimenes.get(clasesRecursadas.get(n.participacionId)!) ?? null,
    })),
    revisionesRecursamiento: revisionesRecursamiento.map((r) => ({
      participacionId: r.participacionId,
      parcial: r.parcial,
      anterior: r.anterior,
      usuarioId: r.usuarioId,
      nueva: r.nueva,
      escalaAnterior: r.escalaAnterior ?? 100,
      escalaNueva: r.escalaNueva ?? 100,
      regimenEvaluacion: regimenes.get(clasesRecursadas.get(r.participacionId)!) ?? null,
      motivo: r.motivo,
      fecha: r.createdAt,
    })),
  };
}
