import { OpenpayService } from './openpay.service';

function config(values: Record<string, string | undefined>) {
  return { get: jest.fn((key: string) => values[key]) } as any;
}

describe('OpenpayService configuration', () => {
  const production = {
    NODE_ENV: 'production',
    OPENPAY_MERCHANT_ID: 'merchant',
    OPENPAY_PRIVATE_KEY: 'private-key',
    OPENPAY_WEBHOOK_USER: 'webhook-user',
    OPENPAY_WEBHOOK_PASS: 'webhook-pass',
    OPENPAY_BASE_URL: 'https://api.openpay.mx/v1',
    OPENPAY_REDIRECT_URL: 'https://portal.colegio.mx/pago-completado',
  };

  it('rechaza configuración productiva incompleta', () => {
    expect(() => new OpenpayService(config({ NODE_ENV: 'production' }))).toThrow('OPENPAY_BASE_URL');
    expect(() => new OpenpayService(config({ ...production, OPENPAY_MERCHANT_ID: '' }))).toThrow('OPENPAY_MERCHANT_ID');
    expect(() => new OpenpayService(config({ ...production, OPENPAY_WEBHOOK_PASS: '' }))).toThrow('OPENPAY_WEBHOOK_USER');
  });

  it.each([
    ['sandbox', 'https://sandbox-api.openpay.mx/v1', 'https://portal.colegio.mx/pago'],
    ['retorno local', 'https://api.openpay.mx/v1', 'http://localhost:5173/pago'],
    ['retorno IP privada', 'https://api.openpay.mx/v1', 'https://192.168.1.20/pago'],
  ])('rechaza %s en producción', (_caso, baseUrl, redirectUrl) => {
    expect(() => new OpenpayService(config({ ...production, OPENPAY_BASE_URL: baseUrl, OPENPAY_REDIRECT_URL: redirectUrl })))
      .toThrow();
  });

  it('acepta las URL productivas explícitas', () => {
    expect(() => new OpenpayService(config(production))).not.toThrow();
  });

  it('conserva sandbox localhost por defecto fuera de producción', () => {
    expect(() => new OpenpayService(config({ NODE_ENV: 'development' }))).not.toThrow();
  });
});
