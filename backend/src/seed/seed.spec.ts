import { obtenerPasswordsSeed, validarEjecucionSeed } from './seed';

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

describe('obtenerPasswordsSeed', () => {
  const base = {
    SEED_ADMIN_PASSWORD: 'Admin-seguro-2026!',
    SEED_COORDINACION_PASSWORD: 'Coord-seguro-2026!',
    SEED_DOCENTE_PASSWORD: 'Docente-seguro-2026!',
    SEED_ALUMNO1_PASSWORD: 'Alumno1-seguro-2026!',
    SEED_ALUMNO2_PASSWORD: 'Alumno2-seguro-2026!',
  };

  it('requiere secretos distintos para todas las cuentas demo', () => {
    expect(obtenerPasswordsSeed(base as NodeJS.ProcessEnv)).toMatchObject({
      admin: base.SEED_ADMIN_PASSWORD,
      alumno2: base.SEED_ALUMNO2_PASSWORD,
    });
    expect(() => obtenerPasswordsSeed({ ...base, SEED_DOCENTE_PASSWORD: '' } as NodeJS.ProcessEnv))
      .toThrow('faltantes');
    expect(() => obtenerPasswordsSeed({ ...base, SEED_DOCENTE_PASSWORD: base.SEED_ADMIN_PASSWORD } as NodeJS.ProcessEnv))
      .toThrow('distinta');
  });

  it('rechaza contraseñas seed cortas', () => {
    expect(() => obtenerPasswordsSeed({ ...base, SEED_ALUMNO1_PASSWORD: 'corta' } as NodeJS.ProcessEnv))
      .toThrow('al menos 16 caracteres');
  });
});
