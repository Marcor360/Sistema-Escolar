import { validarEjecucionSeed } from './seed';

describe('validarEjecucionSeed', () => {
  it('bloquea siempre production aunque ALLOW_DEV_SEED esté activado', () => {
    expect(() => validarEjecucionSeed({ NODE_ENV: 'production', ALLOW_DEV_SEED: 'true' } as NodeJS.ProcessEnv))
      .toThrow('deshabilitado en producción');
  });

  it('exige opt-in explícito para development y test', () => {
    expect(() => validarEjecucionSeed({ NODE_ENV: 'development' } as NodeJS.ProcessEnv))
      .toThrow('ALLOW_DEV_SEED=true');
    expect(() => validarEjecucionSeed({ NODE_ENV: 'test' } as NodeJS.ProcessEnv))
      .toThrow('ALLOW_DEV_SEED=true');
  });

  it.each(['development', 'test'])('permite %s solo con el opt-in', (NODE_ENV) => {
    expect(() => validarEjecucionSeed({ NODE_ENV, ALLOW_DEV_SEED: 'true' } as NodeJS.ProcessEnv)).not.toThrow();
  });

  it('bloquea entornos sin NODE_ENV explícito', () => {
    expect(() => validarEjecucionSeed({ ALLOW_DEV_SEED: 'true' } as NodeJS.ProcessEnv))
      .toThrow('solo se permite en desarrollo o pruebas');
  });
});
