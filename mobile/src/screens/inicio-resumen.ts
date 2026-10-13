import { api } from '../api/client';

export interface AvisoInicio {
  id: number;
  titulo: string;
  mensaje: string;
  leida: boolean;
  createdAt: string;
}

export interface EventoInicio {
  id: number;
  titulo: string;
  tipo: string;
  fechaInicio: string;
}

interface TareaInicio { id: number; entrega: { estatus: string } | null }
interface EstadoCuentaInicio { saldoTotal: number }

export interface ResumenInicio {
  pendientes: number | null;
  saldo: number | null;
  avisos: AvisoInicio[] | null;
  eventos: EventoInicio[] | null;
  errores: string[];
}

function extraer<T>(
  respuesta: PromiseSettledResult<{ data: T }>,
  seccion: string,
  errores: string[],
): T | null {
  if (respuesta.status === 'rejected') {
    errores.push(seccion);
    return null;
  }
  return respuesta.value.data;
}

/** Una sección caída no debe ocultar las respuestas válidas de las demás. */
export async function obtenerResumenInicio(desde: string, hasta: string): Promise<ResumenInicio> {
  const [tareas, cuenta, notificaciones, calendario] = await Promise.allSettled([
    api.get<TareaInicio[]>('/alumnos/me/tareas'),
    api.get<EstadoCuentaInicio>('/finanzas/me/estado-cuenta'),
    api.get<AvisoInicio[]>('/notificaciones/mias'),
    api.get<EventoInicio[]>('/calendario', { params: { desde, hasta } }),
  ]);

  const errores: string[] = [];
  const datosTareas = extraer(tareas, 'tareas', errores);
  const datosCuenta = extraer(cuenta, 'estado de cuenta', errores);
  const datosAvisos = extraer(notificaciones, 'avisos', errores);
  const datosCalendario = extraer(calendario, 'calendario', errores);

  return {
    pendientes: datosTareas === null ? null : datosTareas.filter((tarea) => !tarea.entrega).length,
    saldo: datosCuenta?.saldoTotal ?? null,
    avisos: datosAvisos,
    eventos: datosCalendario,
    errores,
  };
}
