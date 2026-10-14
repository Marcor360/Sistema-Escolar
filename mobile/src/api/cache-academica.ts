/** Retención mínima: solo memoria de la sesión, nunca expedientes académicos en disco/SecureStore. */
const TTL = 5 * 60 * 1000;
let identidad: number | null = null,
  generacion = 0;
const registros = new Map<string, { data: unknown; fecha: number }>();
export function configurarCacheAcademica(usuario: number | null) {
  if (identidad !== usuario) {
    identidad = usuario;
    limpiarCacheAcademica();
  }
}
export function limpiarCacheAcademica() {
  generacion++;
  registros.clear();
}
export async function leerConCache<T>(
  ruta: string,
  solicitar: () => Promise<{ data: T }>,
) {
  const actual = generacion;
  try {
    const respuesta = await solicitar(),
      fecha = Date.now();
    if (actual === generacion && identidad !== null)
      registros.set(ruta, { data: respuesta.data, fecha });
    return { data: respuesta.data, offline: false, fecha };
  } catch (e) {
    const error = e as { response?: unknown; code?: string };
    const cache = registros.get(ruta);
    if (
      actual === generacion &&
      identidad !== null &&
      !error.response &&
      ["ERR_NETWORK", "ECONNABORTED", "ETIMEDOUT"].includes(error.code ?? "") &&
      cache &&
      Date.now() - cache.fecha < TTL
    )
      return { data: cache.data as T, offline: true, fecha: cache.fecha };
    if (cache && Date.now() - cache.fecha >= TTL) registros.delete(ruta);
    throw e;
  }
}
