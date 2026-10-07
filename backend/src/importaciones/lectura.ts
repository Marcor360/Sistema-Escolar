import { inflateRawSync } from 'zlib';
import { BadRequestException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
/** CSV RFC4180: conserva separadores y saltos de línea dentro de celdas entrecomilladas. */
export function leerCsv(texto: string): string[][] {
  const filas: string[][] = []; let fila: string[] = []; let celda = ''; let comillas = false; let cerrada = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (comillas) { if (c === '"') { if (texto[i + 1] === '"') { celda += '"'; i++; } else { comillas = false; cerrada = true; } } else celda += c; }
    else if (c === '"' && !celda && !cerrada) comillas = true;
    else if (c === ',' || c === '\n' || c === '\r') {
      fila.push(celda); celda = ''; cerrada = false;
      if (c !== ',') { if (c === '\r' && texto[i + 1] === '\n') i++; if (fila.some((v) => v.length)) filas.push(fila); fila = []; }
    } else { if (cerrada || c === '"') throw new BadRequestException('CSV inválido: comillas o separadores'); celda += c; }
    if (celda.length > 4000 || filas.length > 500 || fila.length > 30) throw new BadRequestException('Máximo 500 filas y 30 columnas; celdas de hasta 4000 caracteres');
  }
  if (comillas) throw new BadRequestException('CSV inválido: comillas sin cerrar');
  fila.push(celda); if (fila.some((v) => v.length)) filas.push(fila);
  return filas;
}
/** Verifica tamaño expandido antes de descomprimir un XLSX; rechaza ZIP64 y archivos cifrados. */
function limitarZip(buffer: Buffer) {
  let fin = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) if (buffer.readUInt32LE(i) === 0x06054b50) { fin = i; break; }
  if (fin < 0) throw new BadRequestException('XLSX inválido');
  const entradas = buffer.readUInt16LE(fin + 10); let pos = buffer.readUInt32LE(fin + 16); let total = 0;
  if (entradas > 1024 || pos === 0xffffffff) throw new BadRequestException('XLSX demasiado grande');
  for (let i = 0; i < entradas; i++) {
    if (pos + 46 > buffer.length || buffer.readUInt32LE(pos) !== 0x02014b50 || buffer.readUInt16LE(pos + 8) & 1) throw new BadRequestException('XLSX inválido o cifrado');
    const declarado = buffer.readUInt32LE(pos + 24); const comprimido = buffer.readUInt32LE(pos + 20); const local = buffer.readUInt32LE(pos + 42); const metodo = buffer.readUInt16LE(pos + 10);
    if (local + 30 > buffer.length || buffer.readUInt32LE(local) !== 0x04034b50 || ![0, 8].includes(metodo)) throw new BadRequestException('XLSX inválido');
    const inicio = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    if (inicio + comprimido > buffer.length || declarado + total > 25 * 1024 * 1024) throw new BadRequestException('XLSX expandido supera 25 MB');
    let expandido: Buffer;
    try { expandido = metodo === 0 ? buffer.subarray(inicio, inicio + comprimido) : inflateRawSync(buffer.subarray(inicio, inicio + comprimido), { maxOutputLength: 25 * 1024 * 1024 - total }); } catch { throw new BadRequestException('XLSX inválido o demasiado grande'); }
    if (expandido.length !== declarado) throw new BadRequestException('XLSX declara un tamaño incorrecto'); total += expandido.length;
    pos += 46 + buffer.readUInt16LE(pos + 28) + buffer.readUInt16LE(pos + 30) + buffer.readUInt16LE(pos + 32);
  }
}
export async function leerArchivo(buffer: Buffer, nombre: string): Promise<Record<string, string>[]> {
  if (buffer.length > 5 * 1024 * 1024) throw new BadRequestException('Máximo 5 MB');
  let matriz: string[][];
  if (/\.csv$/i.test(nombre)) matriz = leerCsv(buffer.toString('utf8').replace(/^\uFEFF/, ''));
  else if (/\.xlsx$/i.test(nombre)) {
    limitarZip(buffer); const libro = new ExcelJS.Workbook();
    try { await libro.xlsx.load(buffer as unknown as Parameters<typeof libro.xlsx.load>[0]); } catch { throw new BadRequestException('XLSX inválido'); }
    const hoja = libro.worksheets[0]; if (!hoja || hoja.rowCount > 501 || hoja.columnCount > 30) throw new BadRequestException('Máximo 500 registros y 30 columnas');
    matriz = [];
    hoja.eachRow((row) => { const valores: string[] = []; for (let i = 1; i <= hoja.columnCount; i++) {
      const v = row.getCell(i).value;
      if (v !== null && typeof v !== 'string' && typeof v !== 'number' && typeof v !== 'boolean' && !(v instanceof Date)) throw new BadRequestException('No se admiten fórmulas ni celdas especiales');
      const valor = v instanceof Date ? v.toISOString().slice(0, 10) : v === null ? '' : String(v); if (valor.length > 4000) throw new BadRequestException('Celda demasiado larga'); valores.push(valor);
    } matriz.push(valores); });
  } else throw new BadRequestException('Usa CSV o XLSX');
  const [cabecera, ...filas] = matriz;
  if (!cabecera || !filas.length || filas.length > 500) throw new BadRequestException('Incluye cabecera y de 1 a 500 registros');
  const claves = cabecera.map((c) => c.trim()); if (new Set(claves).size !== claves.length || claves.some((c) => !c || !/^[a-zA-Z][a-zA-Z0-9]*$/.test(c))) throw new BadRequestException('Cabeceras vacías, repetidas o inválidas');
  return filas.map((fila) => { if (fila.length > claves.length) throw new BadRequestException('La fila tiene más columnas que la cabecera'); return Object.fromEntries(claves.map((c, i) => [c, fila[i]?.trim() ?? ''])); });
}
