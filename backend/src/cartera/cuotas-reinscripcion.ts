import { BadRequestException, ConflictException } from '@nestjs/common';
import { ConceptoPago } from '../entities';
import { ReinscripcionPeriodoDto } from './reinscripcion-periodo.dto';
const centavos = (v: number) => Math.round(v * 100);
export interface Cuota {
  conceptoId: number;
  nombre: string;
  tipo: string;
  periodo: string;
  fechaVencimiento: string;
  monto: number;
  descuento: number;
}

/** Valida el calendario cotizado; no consulta ni modifica cargos históricos. */
export function cotizarCuotasReinscripcion(
  d: ReinscripcionPeriodoDto,
  conceptos: ConceptoPago[],
  inicio: string,
  fin: string,
) {
  if (
    conceptos.length !== d.conceptoIds.length ||
    conceptos.some((c) => !['INSCRIPCION', 'COLEGIATURA'].includes(c.tipo) || c.montoBase <= 0) ||
    conceptos.filter((c) => c.tipo === 'COLEGIATURA').length > 1
  )
    throw new ConflictException(
      'Selecciona inscripción y una colegiatura con tarifa positiva. Los trámites/recursamientos se gestionan por separado',
    );
  const ajustes = d.ajustes ?? [];
  if (ajustes.some((a) => !conceptos.some((c) => c.id === a.conceptoId && c.tipo === 'COLEGIATURA')))
    throw new BadRequestException('Solo se ajusta la colegiatura del periodo futuro');
  const calendario = d.parcialidades?.length
    ? d.parcialidades
    : conceptos.map((c) => ({
        conceptoId: c.id,
        periodo: d.periodo,
        fechaVencimiento: d.fechaVencimiento,
        monto: ajustes.find((a) => a.conceptoId === c.id)?.monto ?? c.montoBase,
        descuento: 0,
      }));
  const vistos = new Set<string>(),
    cuotas: Cuota[] = [];
  for (const q of calendario) {
    const c = conceptos.find((c) => c.id === q.conceptoId),
      clave = `${q.conceptoId}:${q.periodo}`;
    if (
      !c ||
      vistos.has(clave) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(q.fechaVencimiento) ||
      q.fechaVencimiento < inicio ||
      q.fechaVencimiento > fin ||
      q.periodo < inicio.slice(0, 7) ||
      q.periodo > fin.slice(0, 7) ||
      centavos(q.descuento ?? 0) > centavos(q.monto)
    )
      throw new BadRequestException('Revisa conceptos, cuotas únicas por mes, descuentos y fechas dentro del periodo');
    vistos.add(clave);
    cuotas.push({
      conceptoId: c.id,
      nombre: c.nombre,
      tipo: c.tipo,
      periodo: q.periodo,
      fechaVencimiento: q.fechaVencimiento,
      monto: q.monto,
      descuento: q.descuento ?? 0,
    });
  }
  for (const c of conceptos) {
    const filas = cuotas.filter((q) => q.conceptoId === c.id),
      tarifa = ajustes.find((a) => a.conceptoId === c.id)?.monto ?? c.montoBase;
    if (
      !filas.length ||
      filas.reduce((s, q) => s + centavos(q.monto), 0) !== centavos(tarifa) ||
      (c.tipo !== 'COLEGIATURA' && filas.length !== 1)
    )
      throw new BadRequestException(
        'Las parcialidades deben sumar exactamente la tarifa total del concepto; no se cobra el total además de sus cuotas',
      );
  }
  const motivoFinanciero = [d.motivo, ...ajustes.map((a) => a.motivo)].some(
    (motivo) => (motivo?.trim().length ?? 0) >= 10,
  );
  if ((cuotas.some((q) => q.descuento > 0) || ajustes.length) && !motivoFinanciero)
    throw new BadRequestException('La tarifa personalizada o beca/descuento necesita motivo documentado');
  cuotas.sort((a, b) => a.conceptoId - b.conceptoId || a.periodo.localeCompare(b.periodo));
  return { ajustes, cuotas };
}
