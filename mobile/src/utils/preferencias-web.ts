/** Preferencias públicas y estado de navegación; las credenciales permanecen en memoria y cookies HttpOnly. */
export function leerPreferencia(clave: string, porPestana = false): string | null {
  try {
    return (porPestana ? sessionStorage : localStorage).getItem(clave);
  } catch {
    return null;
  }
}

export function guardarPreferencia(clave: string, valor: string | null, porPestana = false) {
  try {
    const almacen = porPestana ? sessionStorage : localStorage;
    if (valor === null) almacen.removeItem(clave);
    else almacen.setItem(clave, valor);
  } catch { /* El navegador puede bloquear el almacenamiento. */ }
}
