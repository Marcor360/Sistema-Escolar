import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface JwtUser {
  sub: number;        // usuario.id
  email: string;
  nombre: string;
  roles: string[];
}

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): JwtUser => ctx.switchToHttp().getRequest().user,
);
