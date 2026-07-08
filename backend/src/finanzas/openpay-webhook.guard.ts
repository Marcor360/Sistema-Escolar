import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

/**
 * Protege el webhook público. Si el cliente configura usuario/contraseña en el
 * dashboard de Openpay y en el .env (OPENPAY_WEBHOOK_USER/PASS), aquí se exige
 * el encabezado Basic correspondiente; sin configuración queda abierto (sandbox).
 */
@Injectable()
export class OpenpayWebhookGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const usuario = process.env.OPENPAY_WEBHOOK_USER;
    if (!usuario) return true;

    const contrasena = process.env.OPENPAY_WEBHOOK_PASS ?? '';
    const esperado = 'Basic ' + Buffer.from(`${usuario}:${contrasena}`).toString('base64');
    const recibido = context.switchToHttp().getRequest().headers['authorization'] ?? '';
    if (recibido === esperado) return true;
    throw new UnauthorizedException('Webhook no autorizado');
  }
}
