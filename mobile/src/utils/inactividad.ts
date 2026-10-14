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

/** Ordena también el borrado de logout antes de las escrituras de un nuevo login. */
export function crearPersistenciaActividad(
  guardar: (fecha: number) => Promise<void>,
  borrar: () => Promise<void>,
) {
  let cola: Promise<void> = Promise.resolve();
  const encolar = (operacion: () => Promise<void>) => {
    cola = cola.catch(() => undefined).then(operacion).catch(() => undefined);
    return cola;
  };
  return {
    guardar: (fecha: number) => encolar(() => guardar(fecha)),
    borrar: () => encolar(borrar),
  };
}

/** Una marca futura o corrupta no puede extender la sesión restaurada. */
export function actividadRestaurable(valor: string | null, ahora: number): number | null {
  if (valor === null) return ahora; // Compatibilidad con sesiones anteriores al control.
  const fecha = Number(valor);
  return Number.isFinite(fecha) && fecha > 0 && fecha <= ahora &&
    ahora - fecha < LIMITE_INACTIVIDAD_MS ? fecha : null;
}
