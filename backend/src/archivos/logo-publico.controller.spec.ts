import express from 'express';
import helmet from 'helmet';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { Server } from 'http';
import { AddressInfo } from 'net';
import { LogoPublicoController } from './logo-publico.controller';

describe('Logo público con cabeceras de seguridad reales', () => {
  let server: Server;
  let directorio: string;
  let base: string;
  const anterior = process.env.UPLOADS_DIR;
  const nombre = 'marca-logo-1234abcd.png';
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
  beforeAll(async () => {
    directorio = await mkdtemp(join(tmpdir(), 'logo-publico-'));
    process.env.UPLOADS_DIR = directorio;
    await writeFile(join(directorio, nombre), png);
    await writeFile(join(directorio, 'privado.pdf'), 'privado');
    const app = express();
    app.use(helmet({ contentSecurityPolicy: false }));
    const controller = new LogoPublicoController();
    app.get('/uploads/:filename', (req, res) => {
      try { controller.descargar(req.params.filename, res); }
      catch { res.sendStatus(400); }
    });
    app.get('/api/privado', (_req, res) => { res.sendStatus(401); });
    server = await new Promise<Server>((resolve) => {
      const instancia = app.listen(0, '127.0.0.1', () => resolve(instancia));
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    if (anterior === undefined) delete process.env.UPLOADS_DIR; else process.env.UPLOADS_DIR = anterior;
    await rm(directorio, { recursive: true, force: true });
  });
  it('permite incrustar el logo desde el portal de otro origen', async () => {
    const respuesta = await fetch(`${base}/uploads/${nombre}`);
    expect(respuesta.status).toBe(200);
    expect(respuesta.headers.get('cross-origin-resource-policy')).toBe('cross-origin');
    expect(respuesta.headers.get('content-type')).toMatch(/^image\/png/);
    expect(respuesta.headers.get('x-content-type-options')).toBe('nosniff');
    expect(respuesta.headers.get('cache-control')).toContain('immutable');
    expect(Buffer.from(await respuesta.arrayBuffer())).toEqual(png);
  });
  it('mantiene la política restrictiva y la protección de documentos privados', async () => {
    const documento = await fetch(`${base}/uploads/privado.pdf`);
    expect(documento.status).toBe(400);
    expect(documento.headers.get('cross-origin-resource-policy')).toBe('same-origin');
    const privado = await fetch(`${base}/api/privado`);
    expect(privado.status).toBe(401);
    expect(privado.headers.get('cross-origin-resource-policy')).toBe('same-origin');
  });
});
