import { limpiarCacheAcademica } from "./cache-academica";
import { borrarPreferenciaBiometrica } from "../biometria";
import axios, { CanceledError } from "axios";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import { resolverApiUrl } from "./config";
export { mensajeDeError } from "./errores";

const baseURL = resolverApiUrl(
  String(Constants.expoConfig?.extra?.appEnv || "development"),
  Constants.expoConfig?.extra?.apiUrl as string | undefined,
);

export const api = axios.create({
  baseURL,
  timeout: 20000,
  headers: { "x-portal": "MOVIL" },
});

export const TOKEN_KEY = "escolar_token";
export const REFRESH_KEY = "escolar_refresh";
let renovando: Promise<void> | null = null;
let generacion = 0;
let generacionRenovando = -1;
let escritura = Promise.resolve();
function serializarTokens(accion: () => Promise<void>) {
  const siguiente = escritura.then(accion);
  escritura = siguiente.catch(() => undefined);
  return siguiente;
}
export function establecerTokensSesion(
  accessToken: string,
  refreshToken: string,
) {
  const actual = ++generacion;
  limpiarCacheAcademica();
  return serializarTokens(async () => {
    if (actual !== generacion) throw new CanceledError("La sesión cambió");
    await SecureStore.setItemAsync(REFRESH_KEY, refreshToken);
    await SecureStore.setItemAsync(TOKEN_KEY, accessToken);
  });
}
export function eliminarTokensSesion() {
  generacion++;
  limpiarCacheAcademica();
  return serializarTokens(async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(REFRESH_KEY),
      SecureStore.deleteItemAsync(TOKEN_KEY),
      borrarPreferenciaBiometrica(),
    ]);
  });
}
let alExpirarSesion: (() => void) | null = null;

export function registrarSesionExpirada(handler: (() => void) | null) {
  alExpirarSesion = handler;
}

api.interceptors.request.use(async (config) => {
  if (
    [
      "/configuracion/marca",
      "/auth/login",
      "/auth/forgot-password",
      "/auth/reset-password",
      "/auth/solicitar-activacion",
      "/auth/activar-cuenta",
    ].includes(config.url ?? "")
  )
    return config;
  const anterior = (config as typeof config & { generacionSesion?: number })
    .generacionSesion;
  if (anterior !== undefined && anterior !== generacion)
    throw new CanceledError("Solicitud de una sesión anterior");
  const actual = generacion;
  (config as typeof config & { generacionSesion: number }).generacionSesion =
    actual;
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (actual !== generacion) throw new CanceledError("La sesión cambió");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => {
    const actual = (
      response.config as typeof response.config & { generacionSesion?: number }
    ).generacionSesion;
    if (actual !== undefined && actual !== generacion)
      throw new CanceledError("Respuesta de una sesión anterior");
    return response;
  },
  async (error) => {
    if (
      error.config?.generacionSesion !== undefined &&
      error.config.generacionSesion !== generacion
    )
      return Promise.reject(
        new CanceledError("Respuesta de una sesión anterior"),
      );
    // Un segundo 401 tras renovar es definitivo: no dejar una sesión aparente.
    if (
      error.response?.status === 401 &&
      error.config?.headers?.["x-reintento-sesion"]
    ) {
      const cerrada = generacion + 1;
      await eliminarTokensSesion().catch(() => undefined);
      if (generacion === cerrada) alExpirarSesion?.();
      return Promise.reject(error);
    }
    if (
      error.response?.status === 401 &&
      (!error.config?.url?.startsWith("/auth/") ||
        error.config?.url === "/auth/me") &&
      !error.config?.headers["x-reintento-sesion"]
    ) {
      const actual = generacion;
      try {
        if (!renovando || generacionRenovando !== actual) {
          generacionRenovando = actual;
          const promesa = (async () => {
            const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
            if (!refreshToken) throw new Error("Sin refresh");
            const { data } = await axios.post(
              `${baseURL}/auth/refresh`,
              { refreshToken },
              { timeout: 20000, headers: { "x-portal": "MOVIL" } },
            );
            await serializarTokens(async () => {
              if (actual !== generacion)
                throw new CanceledError(
                  "La sesión cambió durante la renovación",
                );
              limpiarCacheAcademica();
              await SecureStore.setItemAsync(REFRESH_KEY, data.refreshToken);
              await SecureStore.setItemAsync(TOKEN_KEY, data.accessToken);
            });
          })().finally(() => {
            if (renovando === promesa) renovando = null;
          });
          renovando = promesa;
        }
        await renovando;
        if (actual !== generacion) throw new CanceledError("La sesión cambió");
        error.config.headers["x-reintento-sesion"] = "1";
        return api.request(error.config);
      } catch (refreshError) {
        if (actual !== generacion)
          return Promise.reject(
            new CanceledError("Renovación de una sesión anterior"),
          );
        const status = (refreshError as { response?: { status?: number } })
          .response?.status;
        if (
          ![401, 403].includes(status ?? 0) &&
          (refreshError as Error).message !== "Sin refresh"
        )
          return Promise.reject(refreshError);
      }
      const cerrada = generacion + 1;
      await eliminarTokensSesion().catch(() => undefined);
      if (generacion === cerrada) alExpirarSesion?.();
    }
    return Promise.reject(error);
  },
);

/** Base sin /api, para enlaces firmados de archivos y recursos públicos de marca. */
export const archivosBase = baseURL.replace(/\/api$/, "");
