import { BadRequestException, ExecutionContext, PayloadTooLargeException } from '@nestjs/common';
import { lastValueFrom, throwError } from 'rxjs';
import { LogoUploadErrorInterceptor, LogoPdfUploadErrorInterceptor } from './logo-upload-error.interceptor';

it('conserva HTTP 413 y traduce el rechazo de Multer', async () => {
  const resultado = new LogoUploadErrorInterceptor().intercept({} as ExecutionContext, {
    handle: () => throwError(() => new PayloadTooLargeException('File too large')),
  });
  await expect(lastValueFrom(resultado)).rejects.toMatchObject({
    response: { statusCode: 413, message: expect.stringContaining('supera los 10 MB') },
  });
});

it('conserva los otros errores de validación', async () => {
  const error = new BadRequestException('Contenido inválido');
  const resultado = new LogoUploadErrorInterceptor().intercept({} as ExecutionContext, {
    handle: () => throwError(() => error),
  });
  await expect(lastValueFrom(resultado)).rejects.toBe(error);
});

it('informa el límite de 3 MB al rechazar el PNG imprimible', async () => {
  const resultado = new LogoPdfUploadErrorInterceptor().intercept({} as ExecutionContext, {
    handle: () => throwError(() => new PayloadTooLargeException('File too large')),
  });
  await expect(lastValueFrom(resultado)).rejects.toMatchObject({ response: { statusCode: 413, message: expect.stringContaining('supera los 3 MB') } });
});
