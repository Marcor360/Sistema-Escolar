import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';

/**
 * Protege el webhook público. Si el cliente configura usuario/contraseña en el
 * dashboard de Openpay y en el .env (OPENPAY_WEBHOOK_USER/PASS), aquí se exige
 * el encabezado Basic correspondiente; sin configuración queda abierto (sandbox).
 */
@Injectable()
export class OpenpayWebhookGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const usuario = process.env.OPENPAY_WEBHOOK_USER;
    const contrasena = process.env.OPENPAY_WEBHOOK_PASS ?? '';
    if (!usuario || !contrasena) {
      if (process.env.NODE_ENV === 'production') {
        throw new UnauthorizedException('Webhook no configurado para producción');
      }
      return true;
    }

    const esperado = Buffer.from('Basic ' + Buffer.from(`${usuario}:${contrasena}`).toString('base64'));
    const header: unknown = context.switchToHttp().getRequest().headers['authorization'];
    const recibido = Buffer.from(typeof header === 'string' ? header : '');
    if (recibido.length === esperado.length && timingSafeEqual(recibido, esperado)) return true;
    throw new UnauthorizedException('Webhook no autorizado');
  }
}
