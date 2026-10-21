import { CallHandler, ExecutionContext, Injectable, NestInterceptor, PayloadTooLargeException } from '@nestjs/common';
import { catchError, Observable, throwError } from 'rxjs';

/** Traduce el rechazo de Multer sin cambiar los límites de otros archivos. */
@Injectable()
export class LogoUploadErrorInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(catchError((error: unknown) => throwError(() =>
      error instanceof PayloadTooLargeException
        ? new PayloadTooLargeException('El logotipo supera los 10 MB permitidos. Selecciona una imagen más ligera.')
        : error,
    )));
  }
}
