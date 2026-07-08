import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Observable, tap } from 'rxjs';
import { Repository } from 'typeorm';
import { BitacoraActividad } from '../entities/bitacora-actividad.entity';

/** Bitácora básica de actividad: registra escrituras autenticadas (POST/PATCH/PUT/DELETE). */
@Injectable()
export class BitacoraInterceptor implements NestInterceptor {
  constructor(
    @InjectRepository(BitacoraActividad)
    private readonly repo: Repository<BitacoraActividad>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const metodo: string = req.method;
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(metodo)) return next.handle();

    return next.handle().pipe(
      tap(() => {
        this.repo
          .insert({
            usuarioId: req.user?.sub ?? null,
            metodo,
            ruta: String(req.originalUrl || req.url).slice(0, 200),
            ip: req.ip ?? null,
          })
          .catch(() => undefined); // la bitácora nunca debe tumbar la petición
      }),
    );
  }
}
