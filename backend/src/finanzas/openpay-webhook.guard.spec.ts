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

  it('permite la petición si no hay usuario/contraseña configurados (comportamiento actual)', () => {
    delete process.env.OPENPAY_WEBHOOK_USER;
    const guard = new OpenpayWebhookGuard();

    expect(guard.canActivate(contexto({}))).toBe(true);
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
