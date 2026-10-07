import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Request } from 'express';
import { catchError, Observable } from 'rxjs';
import { unlink } from 'fs/promises';
import { resolve } from 'path';
import { uploadsPath } from './uploads-path';
/** También cubre rechazo del DTO, que ocurre antes de entrar al servicio. */
@Injectable()
export class LimpiezaUploadInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    return next.handle().pipe(catchError(async (error: unknown) => {
      const archivo = req.file;
      if (archivo?.path && resolve(archivo.path) === resolve(uploadsPath(), archivo.filename)) await unlink(archivo.path).catch(() => undefined);
      throw error;
    }));
  }
}
