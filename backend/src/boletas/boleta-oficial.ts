import PDFDocument from 'pdfkit';
import { randomUUID } from 'crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'fs/promises';
import { basename, dirname, join } from 'path';
import { Inscripcion } from '../entities';
import { BoletaRespuesta } from '../entities/boleta-respuesta.entity';
import { ConfiguracionMarca } from '../entities/configuracion-marca.entity';
import { uploadsPath } from '../common/uploads-path';
import { nombreLogoPdf } from '../configuracion/configuracion.service';

export function rutaOficial(i: Inscripcion, clave: string) {
  if (!/^[a-f0-9-]{36}$/i.test(clave)) throw new Error('Identificador de boleta inválido');
  return join(uploadsPath(), 'historial', String(i.alumnoId), 'boletas', String(i.id), clave + '.pdf');
}

export async function archivarBoleta(i: Inscripcion, respuesta: BoletaRespuesta, marca: ConfiguracionMarca | null) {
  const clave = randomUUID();
  const destino = rutaOficial(i, clave);
  const logo = marca?.logoUrl;
  let imagen: Buffer | undefined;
  if (logo && /^\/uploads\/marca-logo-[a-f0-9-]+\.(png|jpe?g|webp)$/i.test(logo)) {
    imagen = await readFile(join(uploadsPath(), logo.endsWith('.webp') ? nombreLogoPdf(logo) : basename(logo)));
  }
  const doc = new PDFDocument({ size: 'LETTER', margin: 48, info: { Title: 'Boleta oficial' } });
  const partes: Buffer[] = [];
  const pdf = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', parte => partes.push(parte));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(partes)));
  });
  if (imagen) { doc.image(imagen, 48, 40, { fit: [165, 55] }); doc.y = 108; }
  doc.font(join(__dirname, '../reportes/assets/OnestVariable.ttf'));
  doc.fillColor(marca?.colorPrimario || '#14343B').fontSize(15).text(marca?.nombreInstitucion || i.grupo.plantel.nombre);
  doc.fontSize(21).text(marca?.tituloBoleta || 'Boleta oficial de calificaciones');
  doc.moveDown().fillColor('#202830').fontSize(11).text('Folio BO-' + respuesta.id);
  doc.text(i.alumno.usuario.nombreCompleto).text('Matrícula: ' + i.alumno.matricula);
  doc.text([i.grupo.plantel.nombre, i.grupo.ciclo.nombre, i.grupo.nombre].join(' · '));
  doc.moveDown().fontSize(14).text('Materias y calificaciones');
  const filas = JSON.parse(respuesta.snapshotJson!) as { asignatura: string; promedioFinal: number | null; observaciones: string }[];
  for (const fila of filas) {
    doc.moveDown(0.5).fontSize(11).text(fila.asignatura + ' · ' + (fila.promedioFinal ?? 'Pendiente'));
    if (fila.observaciones) doc.fontSize(10).text(fila.observaciones);
  }
  doc.moveDown().fontSize(10).text('Aceptación registrada: ' + respuesta.firmanteNombre);
  doc.text('Fecha: ' + respuesta.createdAt.toISOString()).text('Versión académica: ' + respuesta.versionHash);
  if (marca?.pieBoleta) doc.moveDown().text(marca.pieBoleta);
  doc.end();
  const contenido = await pdf;
  await mkdir(dirname(destino), { recursive: true, mode: 0o700 });
  const temporal = destino + '.tmp';
  try {
    await writeFile(temporal, contenido, { flag: 'wx', mode: 0o600 });
    await rename(temporal, destino);
  } finally {
    await rm(temporal, { force: true });
  }
  return { clave, destino };
}
