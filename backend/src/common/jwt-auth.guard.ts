import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { JwtUser } from './current-user.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    await super.canActivate(context);
    const request = context.switchToHttp().getRequest<Request & { user: JwtUser }>();
    if (request.user.passwordChangeRequired && !['/api/auth/me', '/api/auth/cambiar-password', '/api/auth/logout'].includes(request.path)) {
      throw new ForbiddenException('Debes cambiar la contraseña temporal antes de continuar');
    }
    return true;
  }
}
