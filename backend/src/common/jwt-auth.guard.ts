import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { ConsentimientoInstitucionalService } from '../auth/consentimiento-institucional.service';
import { JwtUser } from './current-user.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly consentimiento: ConsentimientoInstitucionalService) { super(); }
  async canActivate(context: ExecutionContext): Promise<boolean> {
    await super.canActivate(context);
    const request = context.switchToHttp().getRequest<Request & { user: JwtUser }>();
    if (request.user.passwordChangeRequired && !['/api/auth/me', '/api/auth/cambiar-password', '/api/auth/logout'].includes(request.path)) {
      throw new ForbiddenException('Debes cambiar la contraseña temporal antes de continuar');
    }
    if (request.user.portal === 'MOVIL' && request.user.roles.includes('ALUMNO') &&
        !['/api/auth/me', '/api/auth/cambiar-password', '/api/auth/logout', '/api/auth/actividad', '/api/auth/consentimiento'].includes(request.path) &&
        await this.consentimiento.pendiente(request.user)) {
      throw new ForbiddenException('CONSENTIMIENTO_INSTITUCIONAL_PENDIENTE');
    }
    return true;
  }
}
