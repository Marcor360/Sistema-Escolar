import type { Repository } from 'typeorm';
import type { ConfiguracionMarca } from '../entities/configuracion-marca.entity';
import { stub } from '../test-utils/stub';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { ConflictException } from '@nestjs/common';
import { validarContenidoArchivo } from '../common/validar-archivo';
jest.mock('../common/validar-archivo', () => ({ validarContenidoArchivo: jest.fn().mockResolvedValue(undefined) }));

import { ConfiguracionService } from './configuracion.service';

describe('ConfiguracionService', () => {
  afterEach(() => jest.restoreAllMocks());
  const crear = (inicial: Record<string, unknown> | null = null) => {
    let guardada = inicial;
    const repo = {
      findOne: jest.fn(() => Promise.resolve(guardada)),
      findOneOrFail: jest.fn(() => Promise.resolve(guardada)),
      create: jest.fn((valor) => ({ ...valor, actualizadoEn: new Date('2026-07-11T18:00:00.000Z') })),
      save: jest.fn((valor) => {
        guardada = valor;
        return Promise.resolve(valor);
      }),
    };
    const limpiezas = { existsBy: jest.fn().mockResolvedValue(false), insert: jest.fn().mockResolvedValue(undefined) };
    const manager = { getRepository: jest.fn((entidad) => (entidad.name === 'ConfiguracionMarca' ? repo : limpiezas)) };
    Object.assign(repo, { manager: { transaction: jest.fn((fn) => fn(manager)) } });
    return { limpiezas, service: new ConfiguracionService(stub<Repository<ConfiguracionMarca>>(repo)), repo };
  };

  it('crea la fila por defecto cuando no existe y deriva el color oscuro', async () => {
    const { service, repo } = crear();
    await expect(service.obtener()).resolves.toMatchObject({
      nombreInstitucion: 'Sistema Escolar',
      colorPrimario: '#14343B',
      colorPrimarioOscuro: '#0E262B',
    });
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });

  it('actualiza las opciones globales sin alterar la marca anterior', async () => {
    const { service } = crear();
    await expect(
      service.actualizarOpciones({ mensajeBienvenida: 'Bienvenido a IUA', tamanoLogo: 'GRANDE' }),
    ).resolves.toMatchObject({ mensajeBienvenida: 'Bienvenido a IUA', tamanoLogo: 'GRANDE', logoUrl: null });
  });
  it('quitarLogo deja logoUrl en null', async () => {
    const { service, limpiezas } = crear({
      id: 1,
      nombreInstitucion: 'Sistema Escolar',
      nombreCorto: 'SE',
      logoUrl: '/uploads/marca-logo-inexistente.png',
      colorPrimario: '#14343B',
      colorAcento: '#C79A3C',
      actualizadoEn: new Date(),
    });
    await expect(service.quitarLogo()).resolves.toMatchObject({ logoUrl: null });
    expect(limpiezas.insert).toHaveBeenCalledWith(expect.objectContaining({ nombre: 'marca-logo-inexistente.png' }));
  });
  it('retira el archivo nuevo cuando falla la persistencia del logo', async () => {
    const { service, repo } = crear();
    await service.obtener();
    repo.save.mockRejectedValueOnce(new Error('DB no disponible'));
    const unlink = jest.spyOn(fs, 'unlink').mockResolvedValue(undefined);
    const rename = jest.spyOn(fs, 'rename').mockResolvedValue(undefined);
    jest.spyOn(fs, 'access').mockResolvedValue(undefined);
    await expect(
      service.guardarLogo({ path: '/tmp/logo-nuevo.png', filename: 'logo-nuevo.png' } as Express.Multer.File),
    ).rejects.toThrow('DB no disponible');
    expect(validarContenidoArchivo).toHaveBeenCalled();
    expect(rename).toHaveBeenCalledWith('/tmp/logo-nuevo.png', expect.stringMatching(/marca-logo-[0-9a-f-]+\.webp$/));
    expect(unlink).toHaveBeenCalledWith('/tmp/logo-nuevo.png');
    expect(unlink).toHaveBeenCalledWith(expect.stringMatching(/marca-logo-[0-9a-f-]+\.webp$/));
  });

  it('retira ambas variantes al quitar un logo WebP', async () => {
    const nombre = 'marca-logo-a1b2c3d4-1234-4567-89ab-d0123456789a';
    const { service, limpiezas } = crear({ id: 1, logoUrl: '/uploads/' + nombre + '.webp', colorPrimario: '#14343B' });
    await service.quitarLogo();
    expect(limpiezas.insert).toHaveBeenCalledWith(expect.objectContaining({ nombre: nombre + '.webp' }));
    expect(limpiezas.insert).toHaveBeenCalledWith(expect.objectContaining({ nombre: nombre + '.png' }));
  });
  it('rechaza una variante de un logo reemplazado y limpia el temporal', async () => {
    const carpeta = await fs.mkdtemp(join(tmpdir(), 'logo-pdf-'));
    const temporal = join(carpeta, 'prueba.png');
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=',
      'base64',
    );
    await fs.writeFile(temporal, png);
    const { service } = crear({ id: 1, logoUrl: '/uploads/marca-logo-otro.webp' });
    const rename = jest.spyOn(fs, 'rename').mockResolvedValue(undefined);
    try {
      await expect(
        service.guardarLogoPdf(
          { path: temporal, originalname: 'prueba.png' } as Express.Multer.File,
          '/uploads/marca-logo-a1b2c3d4-1234-4567-89ab-d0123456789a.webp',
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(rename).not.toHaveBeenCalled();
      await expect(fs.access(temporal)).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      await fs.rm(carpeta, { recursive: true, force: true });
    }
  });
});
