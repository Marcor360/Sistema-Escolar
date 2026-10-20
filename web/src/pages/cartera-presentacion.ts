export type EstadoApertura = 'ABIERTA' | 'PENDIENTE' | 'REQUIERE_REVISION';
export function estadoApertura(estado: string) {
  switch (estado as EstadoApertura) {
    case 'ABIERTA':
      return { titulo: 'Abierta y asignada', descripcion: 'Inscripción y cargos confirmados para el grupo asignado.' };
    case 'PENDIENTE':
      return { titulo: 'Pendiente de grupo', descripcion: 'La solicitud y las tarifas se conservan; aún no se generan cargos.' };
    case 'REQUIERE_REVISION':
      return { titulo: 'Requiere revisión', descripcion: 'La solicitud fue anulada o cambió de estado. Control Escolar debe revisar su situación.' };
    default:
      return { titulo: 'Estado por verificar', descripcion: 'Consulta con Control Escolar antes de continuar.' };
  }
}
const moneda = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
export const montoMXN = (monto: number) => moneda.format(monto);
export const reglasAgrupacion = [
  'Entre 1 y 4 alumnos compatibles sin grupo disponible: solicitud pendiente, sin cargos nuevos.',
  'Desde 5 alumnos compatibles: el servidor organiza grupos ordinarios según sus restricciones.',
  'El algoritmo puede acomodar hasta 54 alumnos solo bajo su excepción de remanente; no traslada alumnos de otros programas.',
] as const;
