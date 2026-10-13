import { inflateSync } from 'zlib';

/** Lee los streams FlateDecode de los PDF generados por PDFKit, con longitud directa. */
export function extraerStreamsPdf(documento: Buffer): Buffer[] {
  const texto = documento.toString('latin1');
  const cabeceras = /<<((?:(?!endobj)[\s\S])*?)>>\s*stream\r?\n/g;
  const streams: Buffer[] = [];
  let cabecera: RegExpExecArray | null;
  while ((cabecera = cabeceras.exec(texto))) {
    const longitud = /\/Length\s+(\d+)\b/.exec(cabecera[1]);
    if (!longitud) throw new Error('Stream PDF sin longitud directa');
    const inicio = cabeceras.lastIndex;
    const fin = inicio + Number(longitud[1]);
    if (fin > documento.length) throw new Error('Stream PDF truncado');
    if (/\/Filter\s+\/FlateDecode\b/.test(cabecera[1])) {
      streams.push(inflateSync(documento.subarray(inicio, fin)));
    }
    cabeceras.lastIndex = fin;
  }
  return streams;
}
