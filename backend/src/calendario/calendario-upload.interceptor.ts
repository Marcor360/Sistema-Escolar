import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { catchError } from 'rxjs';
import { promises as fs } from 'fs';
@Injectable()
export class CalendarioUploadInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(
      catchError(async (error: unknown) => {
        const file = ctx.switchToHttp().getRequest<{ file?: Express.Multer.File }>().file;
        if (file) await fs.unlink(file.path).catch(() => undefined);
        throw error;
      }),
    );
  }
}
