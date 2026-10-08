import { promises as fs } from 'fs';
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
    const manager = { getRepository: jest.fn((entidad) => entidad.name === 'ConfiguracionMarca' ? repo : limpiezas) };
    Object.assign(repo, { manager: { transaction: jest.fn((fn) => fn(manager)) } });
    return { limpiezas, service: new ConfiguracionService(repo as any), repo };
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
    await expect(service.guardarLogo({ path: '/tmp/logo-nuevo.png', filename: 'logo-nuevo.png' } as Express.Multer.File)).rejects.toThrow('DB no disponible');
    expect(validarContenidoArchivo).toHaveBeenCalled();
    expect(unlink).toHaveBeenCalledWith('/tmp/logo-nuevo.png');
  });

});
