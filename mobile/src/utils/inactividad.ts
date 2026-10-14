export const LIMITE_INACTIVIDAD_MS = 30 * 60 * 1000;
export const CLAVE_ULTIMA_ACTIVIDAD = "escolar_ultima_actividad";

/** Control basado en reloj real: una aplicación suspendida no reinicia el plazo. */
export function crearControlInactividad(
  salir: () => void,
  ahora: () => number = Date.now,
  programar: typeof setTimeout = setTimeout,
  cancelar: typeof clearTimeout = clearTimeout,
  ultimaInicial: number = ahora(),
) {
  let ultima = ultimaInicial;
  let vencida = false;
  let temporizador: ReturnType<typeof setTimeout> | null = null;

  const comprobar = () => {
    if (vencida) return;
    if (temporizador !== null) cancelar(temporizador);
    const restante = LIMITE_INACTIVIDAD_MS - (ahora() - ultima);
    if (restante <= 0) {
      vencida = true;
      salir();
      return;
    }
    temporizador = programar(comprobar, restante);
  };

  const actividad = () => {
    if (vencida) return;
    if (ahora() - ultima >= LIMITE_INACTIVIDAD_MS) {
      comprobar();
      return;
    }
    ultima = ahora();
    comprobar();
  };
  comprobar();
  return {
    actividad,
    comprobar,
    ultimaActividad: () => ultima,
    detener: () => {
      vencida = true;
      if (temporizador !== null) cancelar(temporizador);
    },
  };
}
