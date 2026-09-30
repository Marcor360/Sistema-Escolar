import { ForbiddenException } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import { BitacoraInterceptor } from './bitacora.interceptor';

const contexto = (req: any, res: any): any => ({
  switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
});

describe('BitacoraInterceptor', () => {
  it('registra actor, entidad, id y resultado exitoso sin persistir el body', async () => {
    const repo = { insert: jest.fn().mockResolvedValue(undefined) };
    const interceptor = new BitacoraInterceptor(repo as any);
    const req = {
      method: 'POST', originalUrl: '/api/alumnos', baseUrl: '/alumnos', route: { path: '' },
      params: {}, ip: '127.0.0.1', user: { sub: 15 }, body: { curp: 'dato-personal' },
    };
    const observable = interceptor.intercept(contexto(req, { statusCode: 201 }), {
      handle: () => of({ id: 32 }),
    } as any);

    await lastValueFrom(observable);
    expect(repo.insert).toHaveBeenCalledWith(expect.objectContaining({
      usuarioId: 15, metodo: 'POST', entidad: '/alumnos', entidadId: 32,
      resultado: 'EXITO', statusCode: 201,
    }));
    expect(JSON.stringify(repo.insert.mock.calls[0][0])).not.toContain('dato-personal');
  });

  it('registra el error HTTP de una escritura fallida', async () => {
    const repo = { insert: jest.fn().mockResolvedValue(undefined) };
    const interceptor = new BitacoraInterceptor(repo as any);
    const observable = interceptor.intercept(
      contexto({ method: 'PATCH', originalUrl: '/api/alumnos/9', baseUrl: '/alumnos', route: { path: '/:id' }, params: { id: '9' }, ip: '127.0.0.1', user: { sub: 15 } }, { statusCode: 200 }),
      { handle: () => throwError(() => new ForbiddenException()) } as any,
    );

    await expect(lastValueFrom(observable)).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.insert).toHaveBeenCalledWith(expect.objectContaining({
      usuarioId: 15, entidad: '/alumnos/:id', entidadId: 9,
      resultado: 'ERROR', statusCode: 403,
    }));
  });
});
