import { deflateSync } from 'zlib';
import PDFDocument from 'pdfkit';
import { extraerStreamsPdf } from './pdf-streams';

function pdfConStream(contenido: Buffer): Buffer {
  return Buffer.concat([
    Buffer.from(`1 0 obj\n<< /Length ${contenido.length} /Filter /FlateDecode >>\nstream\n`),
    contenido,
    Buffer.from('\nendstream\nendobj\n'),
  ]);
}

it('conserva el byte CR al final de un stream comprimido', () => {
  const original = Buffer.from([12]);
  const comprimido = deflateSync(original);
  expect(comprimido.at(-1)).toBe(13);
  expect(extraerStreamsPdf(pdfConStream(comprimido))).toEqual([original]);
});

it('no acepta un stream declarado más largo que los bytes recibidos', () => {
  expect(() => extraerStreamsPdf(Buffer.from('<< /Length 100 /Filter /FlateDecode >>\nstream\n123')))
    .toThrow('Stream PDF truncado');
});

it('lee los streams de un PDF real generado con PDFKit', async () => {
  const documento = new PDFDocument();
  const completo = new Promise<Buffer>((resolve, reject) => {
    const partes: Buffer[] = [];
    documento.on('data', (parte: Buffer) => partes.push(parte));
    documento.on('end', () => resolve(Buffer.concat(partes)));
    documento.on('error', reject);
  });
  documento.text('Colegio Institucional General');
  documento.end();
  const streams = extraerStreamsPdf(await completo);
  const textos = streams.flatMap((stream) => [...stream.toString('latin1').matchAll(/<([0-9a-f]+)>/gi)]
    .map((m) => Buffer.from(m[1], 'hex').toString('latin1'))).join('');
  expect(textos).toContain('Colegio Institucional General');
});
