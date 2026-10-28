import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { validarContenidoArchivo } from './validar-archivo';

describe('Contenido de archivos', () => {
  let carpeta: string;
  beforeEach(async () => {
    carpeta = await mkdtemp(join(tmpdir(), 'escolar-archivo-'));
  });
  afterEach(async () => {
    await rm(carpeta, { recursive: true, force: true });
  });
  async function archivo(nombre: string, contenido: string | Buffer) {
    const path = join(carpeta, nombre);
    await writeFile(path, contenido);
    return { path, originalname: nombre } as Express.Multer.File;
  }
  it('rechaza un ejecutable renombrado a PDF', async () => {
    await expect(validarContenidoArchivo(await archivo('tarea.pdf', 'MZ ejecutable'))).rejects.toThrow('contenido');
  });
  it('acepta PDF y texto UTF-8, pero rechaza texto binario', async () => {
    await expect(validarContenidoArchivo(await archivo('tarea.pdf', '%PDF-1.7\n'))).resolves.toBeUndefined();
    await expect(validarContenidoArchivo(await archivo('tarea.txt', 'Evaluación de español'))).resolves.toBeUndefined();
    await expect(validarContenidoArchivo(await archivo('binario.txt', Buffer.from([65, 0, 66])))).rejects.toThrow(
      'contenido',
    );
  });
});
describe('Formatos académicos adicionales', () => {
  let carpeta: string;
  beforeEach(async () => {
    carpeta = await mkdtemp(join(tmpdir(), 'escolar-formato-'));
  });
  afterEach(async () => {
    await rm(carpeta, { recursive: true, force: true });
  });
  it.each([
    ['tarea.rtf', Buffer.from('{\\rtf1 texto')],
    ['datos.csv', Buffer.from('nombre,nota\nQA,90')],
    ['informe.odt', Buffer.from('504b030400000000', 'hex')],
    ['foto.webp', Buffer.from('RIFF0000WEBP')],
    ['imagen.gif', Buffer.from('GIF89a')],
    ['imagen.bmp', Buffer.from('BM0000')],
    ['voz.mp3', Buffer.from('ID3')],
    ['voz.wav', Buffer.from('RIFF0000WAVE')],
    ['video.mp4', Buffer.from('0000ftypisom')],
    ['voz.m4a', Buffer.from('0000ftypM4A ')],
  ])('valida firma de %s y rechaza ejecutables renombrados', async (nombre, contenido) => {
    const path = join(carpeta, nombre);
    await writeFile(path, contenido);
    const file = { path, originalname: nombre } as Express.Multer.File;
    await expect(validarContenidoArchivo(file)).resolves.toBeUndefined();
    await writeFile(path, Buffer.from('MZ\0ejecutable'));
    await expect(validarContenidoArchivo(file)).rejects.toThrow('contenido');
  });
});
it('acepta UTF-8 multibyte al final de la muestra sin aceptar una secuencia final inválida', async () => {
  const carpeta = await mkdtemp(join(tmpdir(), 'escolar-utf8-'));
  try {
    const path = join(carpeta, 'texto.csv');
    await writeFile(path, Buffer.concat([Buffer.alloc(8191, 65), Buffer.from('ñ,nota\n')]));
    await expect(
      validarContenidoArchivo({ path, originalname: 'texto.csv' } as Express.Multer.File),
    ).resolves.toBeUndefined();
    await writeFile(path, Buffer.from([65, 0xc3]));
    await expect(validarContenidoArchivo({ path, originalname: 'texto.csv' } as Express.Multer.File)).rejects.toThrow(
      'contenido',
    );
  } finally {
    await rm(carpeta, { recursive: true, force: true });
  }
});
