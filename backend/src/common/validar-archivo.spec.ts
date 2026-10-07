import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { validarContenidoArchivo } from './validar-archivo';

describe('Contenido de archivos', () => {
  let carpeta: string;
  beforeEach(async () => { carpeta = await mkdtemp(join(tmpdir(), 'escolar-archivo-')); });
  afterEach(async () => { await rm(carpeta, { recursive: true, force: true }); });
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
    await expect(validarContenidoArchivo(await archivo('binario.txt', Buffer.from([65, 0, 66])))).rejects.toThrow('contenido');
  });
});
