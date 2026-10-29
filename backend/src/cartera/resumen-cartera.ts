import { EntityManager, In } from 'typeorm';
import { AperturaCartera, Cargo, Pago } from '../entities';

/** Solo después de validar alcance. Pagos confirmados de los cargos del plantel histórico autorizado. */
export async function resumenCarteraAlumno(m: EntityManager, alumnoId: number, plantelId: number) {
  const aperturas = await m
    .getRepository(AperturaCartera)
    .find({ where: { alumnoId, plantelId }, order: { id: 'DESC' } });
  const cargos = await m.getRepository(Cargo).find({ where: { alumnoId, plantelId }, order: { id: 'ASC' } });
  const pagos = cargos.length
    ? await m
        .getRepository(Pago)
        .find({
          where: { alumnoId, plantelId, cargoId: In(cargos.map((c) => c.id)), estatus: 'CONFIRMADO' },
          loadEagerRelations: false,
        })
    : [];
  const detalle = cargos.map((c) => {
    const pagado = pagos.filter((p) => p.cargoId === c.id).reduce((n, p) => n + Math.round(p.monto * 100), 0);
    const importe = Math.round(c.monto * 100) - Math.round(c.descuento * 100) + Math.round(c.recargo * 100);
    return {
      id: c.id,
      cicloId: c.cicloId,
      concepto: c.descripcion,
      periodo: c.periodo,
      fechaVencimiento: c.fechaVencimiento,
      monto: c.monto,
      descuento: c.descuento,
      recargo: c.recargo,
      pagado: pagado / 100,
      saldo: c.estatus === 'CANCELADO' ? 0 : Math.max(0, importe - pagado) / 100,
      estado: c.estatus,
    };
  });
  return {
    aperturas: aperturas.map((a) => ({
      id: a.id,
      cicloId: a.cicloId,
      estado: a.estado,
      total: a.conceptos.reduce((n, c) => n + Math.round(c.monto * 100), 0) / 100,
      cuotas: a.conceptos,
    })),
    cargos: detalle,
    pagado: detalle.reduce((n, c) => n + Math.round(c.pagado * 100), 0) / 100,
    saldo: detalle.reduce((n, c) => n + Math.round(c.saldo * 100), 0) / 100,
  };
}
