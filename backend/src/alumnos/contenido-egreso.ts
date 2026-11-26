import { ConflictException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { EgresoDocumentoParte } from '../entities/egreso-documento.entity';

// Base64 ASCII de 48 KiB por fila cabe íntegramente en TEXT de MySQL y NVARCHAR(MAX) de SQL Server.
const BYTES_POR_PARTE = 36 * 1024;
export async function guardarContenido(
  manager: EntityManager,
  documentoId: number,
  tipo: EgresoDocumentoParte['tipo'],
  bytes: Buffer,
) {
  for (let inicio = 0; inicio < bytes.length; inicio += BYTES_POR_PARTE) {
    const datos = bytes.subarray(inicio, inicio + BYTES_POR_PARTE).toString('base64');
    await manager.insert(EgresoDocumentoParte, { documentoId, tipo, orden: inicio / BYTES_POR_PARTE, datos });
  }
}
export async function leerContenido(
  manager: EntityManager,
  documentoId: number,
  tipo: EgresoDocumentoParte['tipo'],
) {
  const partes = await manager.find(EgresoDocumentoParte, {
    where: { documentoId, tipo },
    order: { orden: 'ASC' },
  });
  if (!partes.length || partes.some((p, i) => p.orden !== i))
    throw new ConflictException('El documento requiere revisión de integridad');
  return Buffer.concat(partes.map((p) => Buffer.from(p.datos, 'base64')));
}
