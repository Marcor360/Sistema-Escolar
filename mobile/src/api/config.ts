/** Configuración incorporada al bundle; HTTP y localhost sólo en desarrollo. */
export function resolverApiUrl(appEnv: string, apiUrl?: string): string {
  if (!["development", "preview", "production"].includes(appEnv))
    throw new Error("Entorno móvil no reconocido");
  const valor =
    apiUrl?.trim().replace(/\/+$/, "") ||
    (appEnv === "development" ? "http://localhost:3000/api" : "");
  if (!valor) throw new Error(`Falta la URL de la API para ${appEnv}`);
  let url: URL;
  try {
    url = new URL(valor);
  } catch {
    throw new Error(`La URL de la API para ${appEnv} no es válida`);
  }
  if (!["http:", "https:"].includes(url.protocol))
    throw new Error("La URL de API debe usar HTTP o HTTPS");
  if (
    appEnv !== "development" &&
    (url.protocol !== "https:" ||
      /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(url.hostname))
  ) {
    throw new Error(`La URL de la API para ${appEnv} debe usar HTTPS público`);
  }
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/api"
  ) {
    throw new Error(
      "La URL de API debe terminar en /api y no incluir credenciales, parámetros ni fragmentos",
    );
  }
  return valor;
}
