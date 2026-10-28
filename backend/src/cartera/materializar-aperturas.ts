import { ConflictException } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { AperturaCartera, BitacoraFinanciera, Cargo } from '../entities';
import { JwtUser } from '../common/current-user.decorator';
/** Comparte el commit y precios congelados de aperturas ordinarias; no cobra pagos. */
export async function materializarAperturas(m: EntityManager, solicitudIds: number[], u: JwtUser) {
  if (!solicitudIds.length) return;
  const repo = m.getRepository(AperturaCartera),
    asignadas = await repo.find({ where: { solicitudId: In(solicitudIds) }, order: { id: 'ASC' } });
  for (const a of asignadas) {
    if (a.estado === 'ABIERTA') continue;
    const cargos = m.getRepository(Cargo);
    for (const c of a.conceptos) {
      const claveGeneracion =
        c.tipo === 'COLEGIATURA'
          ? `COLEGIATURA:${a.cicloId}:${a.alumnoId}:${c.periodo}`
          : `APERTURA:${a.id}:${c.conceptoId}`;
      const existente = await cargos.findOneBy({
        alumnoId: a.alumnoId,
        cicloId: a.cicloId,
        conceptoId: c.conceptoId,
        periodo: c.periodo,
      });
      if (existente) {
        if (
          existente.estatus === 'CANCELADO' ||
          existente.monto !== c.monto ||
          existente.claveGeneracion !== claveGeneracion
        )
          throw new ConflictException('Existe un cargo previo incompatible; Finanzas debe revisarlo sin duplicarlo');
        c.cargoId = existente.id;
      } else {
        const cargo = await cargos.save(
          cargos.create({
            plantelId: a.plantelId,
            alumnoId: a.alumnoId,
            cicloId: a.cicloId,
            conceptoId: c.conceptoId,
            periodo: c.periodo,
            claveGeneracion,
            descripcion: c.nombre,
            monto: c.monto,
            descuento: 0,
            recargo: 0,
            fechaVencimiento: c.fechaVencimiento,
            estatus: 'PENDIENTE',
          }),
        );
        c.cargoId = cargo.id;
        await m
          .getRepository(BitacoraFinanciera)
          .insert({
            usuarioId: u.sub,
            plantelId: a.plantelId,
            accion: 'APERTURA_CARGO',
            entidad: 'cargo',
            entidadId: cargo.id,
            detalle: `aperturaId=${a.id}; monto autorizado=${c.monto}`,
          });
      }
    }
    await repo.update(a.id, { estado: 'ABIERTA', conceptos: a.conceptos });
  }
}
