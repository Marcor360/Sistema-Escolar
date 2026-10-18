import express from 'express';
import multer from 'multer';
import { mkdtemp, readdir, rm, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { Server } from 'http';
import { AddressInfo } from 'net';
import { logoUploadConfig } from './logo-upload.config';
import { validarContenidoArchivo } from '../common/validar-archivo';

describe('logo multipart real en almacenamiento temporal', () => {
  let server: Server;
  let directorio: string;
  let url: string;
  const anterior = process.env.UPLOADS_DIR;
  beforeAll(async () => {
    directorio = await mkdtemp(join(tmpdir(), 'logo-test-'));
    process.env.UPLOADS_DIR = directorio;
    const app = express();
    app.post('/logo', multer({ ...logoUploadConfig, fileFilter: (req, file, cb) =>
      logoUploadConfig.fileFilter(req, file, (error, aceptar) => error ? cb(error) : cb(null, aceptar)),
    }).single('logo'), async (req, res) => {
      try {
        await validarContenidoArchivo(req.file!);
        res.status(201).json({ size: req.file!.size });
      } catch {
        await unlink(req.file!.path);
        res.sendStatus(400);
      }
    });
    app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(err instanceof multer.MulterError ? 413 : 400).json({ message: err.message });
    });
    server = await new Promise<Server>((resolve) => {
      const instancia = app.listen(0, '127.0.0.1', () => resolve(instancia));
    });
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/logo`;
  });
  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
    if (anterior === undefined) delete process.env.UPLOADS_DIR; else process.env.UPLOADS_DIR = anterior;
    await rm(directorio, { recursive: true, force: true });
  });
  const subir = (size: number, nombre = 'logo.png', firma = '89504e470d0a1a0a') => {
    const bytes = Buffer.alloc(size);
    Buffer.from(firma, 'hex').copy(bytes);
    const form = new FormData();
    form.append('logo', new Blob([bytes]), nombre);
    return fetch(url, { method: 'POST', body: form });
  };
  it.each([2 * 1024 * 1024 - 1, 2 * 1024 * 1024])('acepta PNG de %i bytes', async (size) => {
    const respuesta = await subir(size);
    expect(respuesta.status).toBe(201);
    expect(await respuesta.json()).toEqual({ size });
  });
  it('rechaza un byte de exceso y limpia el temporal sin tocar archivos previos', async () => {
    const previos = await readdir(directorio);
    expect((await subir(2 * 1024 * 1024 + 1)).status).toBe(413);
    expect(await readdir(directorio)).toEqual(previos);
  });
  it.each([['logo.png', '00000000'], ['logo.exe', '89504e470d0a1a0a']])('rechaza formato falso o extensión inválida: %s', async (nombre, firma) => {
    const previos = await readdir(directorio);
    expect((await subir(20, nombre, firma)).status).toBe(400);
    expect(await readdir(directorio)).toEqual(previos);
  });
});
