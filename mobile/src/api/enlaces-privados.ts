/** Solo abre recursos firmados del origen de la API, nunca redirecciones arbitrarias. */
export function resolverEnlacePrivado(
  origenApi: string,
  ruta: string,
  tipo: "boleta" | "material" | "temario",
  materialId?: number,
): string {
  if (typeof ruta !== "string" || !ruta.startsWith("/api/") || /[%\\#]/.test(ruta)) {
    throw new Error("El servidor devolvió un enlace de documento inválido.");
  }
  const origen = new URL(origenApi);
  const destino = new URL(ruta, origen);
  const patron = tipo === "boleta"
    ? /^\/api\/reportes\/boleta-descarga\/[1-9]\d*$/
    : tipo === "temario" ? /^\/api\/archivos\/temarios\/[1-9]\d*$/ : /^\/api\/archivos\/materiales\/[1-9]\d*$/;
  if (
    destino.origin !== origen.origin ||
    !patron.test(destino.pathname) ||
    (tipo === "material" && destino.pathname !== `/api/archivos/materiales/${materialId}`) ||
    (tipo === "temario" && destino.pathname !== `/api/archivos/temarios/${materialId}`) ||
    destino.username ||
    destino.password ||
    destino.hash ||
    destino.searchParams.size !== 1 ||
    !/^[A-Za-z0-9._~-]+$/.test(destino.searchParams.get("t") ?? "")
  ) {
    throw new Error("El servidor devolvió un enlace de documento inválido.");
  }
  return destino.toString();
}
