import { ConfiguracionService } from './configuracion.service';

describe('ConfiguracionService', () => {
  const crear = (inicial: Record<string, unknown> | null = null) => {
    let guardada = inicial;
    const repo = {
      findOne: jest.fn(() => Promise.resolve(guardada)),
      create: jest.fn((valor) => ({ ...valor, actualizadoEn: new Date('2026-07-11T18:00:00.000Z') })),
      save: jest.fn((valor) => {
        guardada = valor;
        return Promise.resolve(valor);
      }),
    };
    return { service: new ConfiguracionService(repo as any), repo };
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
    const { service } = crear({
      id: 1,
      nombreInstitucion: 'Sistema Escolar',
      nombreCorto: 'SE',
      logoUrl: '/uploads/marca-logo-inexistente.png',
      colorPrimario: '#14343B',
      colorAcento: '#C79A3C',
      actualizadoEn: new Date(),
    });
    await expect(service.quitarLogo()).resolves.toMatchObject({ logoUrl: null });
  });
});
