import PDFDocument from 'pdfkit';
import { join } from 'path';
import { BoletaRespuesta } from '../entities/boleta-respuesta.entity';
/** Comprobante privado de un evento histórico: no es una firma certificada. */
export function constanciaBoleta(
  r: BoletaRespuesta,
  alumno: string,
  matricula: string,
  vigente: boolean,
): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'LETTER', margin: 45 }),
    partes: Buffer[] = [];
  const resultado = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (p: Buffer) => partes.push(p));
    doc.on('end', () => resolve(Buffer.concat(partes)));
    doc.on('error', reject);
  });
  doc.registerFont('Escolar', join(__dirname, '../reportes/assets/OnestVariable.ttf'));
  doc.font('Escolar').fontSize(17).text('Constancia de aceptación de boleta');
  doc.moveDown().fontSize(11).text(`Folio: BA-${r.id}`);
  doc.text(`Alumno: ${alumno}`).text(`Matrícula: ${matricula}`);
  doc.moveDown().text(`Nombre de quien firma: ${r.firmanteNombre}`);
  doc.text(`Identificación declarada: ${r.firmanteTipo === 'TUTOR' ? 'Padre, madre o tutor' : 'Alumno'}`);
  doc.text(`Fecha de registro: ${r.createdAt.toISOString()} (UTC)`);
  doc.text('Respuesta: Aceptación con nombre completo y confirmación explícita.');
  doc.text(`Versión académica: ${r.versionHash}`);
  doc.text(
    vigente
      ? 'La huella coincide con la versión académica consultada.'
      : 'Constancia histórica: las calificaciones actuales corresponden a otra versión o están pendientes de publicación.',
  );
  const filas = JSON.parse(r.snapshotJson ?? '[]') as {
    asignatura: string;
    promedioFinal: number | null;
    observaciones: string;
  }[];
  doc.moveDown().fontSize(12).text('Calificaciones aceptadas en ese momento');
  for (const fila of filas) {
    doc
      .moveDown(0.5)
      .fontSize(10)
      .text(`${fila.asignatura}: ${fila.promedioFinal ?? 'Pendiente'}`);
    if (fila.observaciones) doc.fontSize(9).text(fila.observaciones);
  }
  doc
    .moveDown()
    .fontSize(9)
    .text(
      'Este comprobante conserva una respuesta registrada desde la cuenta del alumno. La identidad del tutor es declarada; no constituye firma electrónica certificada ni sustituye una boleta oficial. Una respuesta posterior no elimina este evento histórico.',
    );
  doc.end();
  return resultado;
}
