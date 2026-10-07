import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Observable, tap } from 'rxjs';
import { Repository } from 'typeorm';
import { BitacoraActividad } from '../entities/bitacora-actividad.entity';

/** Registra escrituras sin guardar cuerpos de solicitudes ni datos personales de formularios. */
@Injectable()
export class BitacoraInterceptor implements NestInterceptor {
  constructor(
    @InjectRepository(BitacoraActividad)
    private readonly repo: Repository<BitacoraActividad>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();
    const metodo: string = req.method;
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(metodo)) return next.handle();

    const ruta = String(req.originalUrl || req.url).slice(0, 200);
    const routeTemplate = String(`${req.baseUrl || ''}${req.route?.path || ''}`).replace(/\/{2,}/g, '/');
    const params = req.params ?? {};
    const rawId = params.id ?? params.alumnoId ?? params.cargoId ?? params.grupoId ?? params.grupoMateriaId;
    const entidadId = rawId !== undefined && /^\d+$/.test(String(rawId)) ? Number(rawId) : null;
    const base = {
      usuarioId: req.user?.sub ?? null,
      metodo,
      ruta,
      entidad: routeTemplate.slice(0, 100) || null,
      entidadId,
      ip: req.ip ?? null,
    };
    const registrar = (resultado: 'EXITO' | 'ERROR', statusCode: number, respuesta?: unknown) => {
      const idRespuesta = (respuesta as { id?: unknown } | null)?.id;
      const id = idRespuesta !== undefined && /^\d+$/.test(String(idRespuesta)) ? Number(idRespuesta) : entidadId;
      void this.repo.insert({ ...base, entidadId: id, resultado, statusCode }).catch((): undefined => undefined);
    };

    return next.handle().pipe(
      tap({
        next: (respuesta: unknown) => registrar(res.statusCode >= 400 ? 'ERROR' : 'EXITO', res.statusCode, respuesta),
        error: (error: { status?: number; statusCode?: number; getStatus?: () => number }) => {
          const status = error?.getStatus?.() ?? error?.statusCode ?? error?.status ?? 500;
          registrar('ERROR', status);
        },
      }),
    );
  }
}
