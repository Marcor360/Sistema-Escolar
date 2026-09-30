import { UnauthorizedException } from '@nestjs/common';
import { OpenpayWebhookGuard } from './openpay-webhook.guard';

const contexto = (headers: Record<string, string>): any => ({
  switchToHttp: () => ({ getRequest: () => ({ headers }) }),
});

describe('OpenpayWebhookGuard', () => {
  const envOriginal = { ...process.env };
  afterEach(() => {
    process.env = { ...envOriginal };
  });

  it('permite el webhook sin credenciales fuera de producción', () => {
    delete process.env.OPENPAY_WEBHOOK_USER;
    delete process.env.OPENPAY_WEBHOOK_PASS;
    process.env.NODE_ENV = 'test';
    const guard = new OpenpayWebhookGuard();

    expect(guard.canActivate(contexto({}))).toBe(true);
  });

  it('falla cerrado en producción si faltan credenciales', () => {
    delete process.env.OPENPAY_WEBHOOK_USER;
    delete process.env.OPENPAY_WEBHOOK_PASS;
    process.env.NODE_ENV = 'production';
    const guard = new OpenpayWebhookGuard();

    expect(() => guard.canActivate(contexto({}))).toThrow(UnauthorizedException);
  });

  it('rechaza sin encabezado Authorization cuando sí hay credenciales configuradas', () => {
    process.env.OPENPAY_WEBHOOK_USER = 'openpay';
    process.env.OPENPAY_WEBHOOK_PASS = 'secreto';
    const guard = new OpenpayWebhookGuard();

    expect(() => guard.canActivate(contexto({}))).toThrow(UnauthorizedException);
  });

  it('rechaza con credenciales incorrectas', () => {
    process.env.OPENPAY_WEBHOOK_USER = 'openpay';
    process.env.OPENPAY_WEBHOOK_PASS = 'secreto';
    const guard = new OpenpayWebhookGuard();
    const malas = 'Basic ' + Buffer.from('openpay:incorrecta').toString('base64');

    expect(() => guard.canActivate(contexto({ authorization: malas }))).toThrow(UnauthorizedException);
  });

  it('permite con credenciales correctas', () => {
    process.env.OPENPAY_WEBHOOK_USER = 'openpay';
    process.env.OPENPAY_WEBHOOK_PASS = 'secreto';
    const guard = new OpenpayWebhookGuard();
    const buenas = 'Basic ' + Buffer.from('openpay:secreto').toString('base64');

    expect(guard.canActivate(contexto({ authorization: buenas }))).toBe(true);
  });
});
