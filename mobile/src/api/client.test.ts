import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  secure: {
    getItemAsync: vi.fn(),
    setItemAsync: vi.fn(),
    deleteItemAsync: vi.fn(),
  },
}));
vi.mock("expo-secure-store", () => mocks.secure);
vi.mock("expo-constants", () => ({
  default: {
    expoConfig: {
      extra: { appEnv: "development", apiUrl: "http://localhost:3000/api" },
    },
  },
}));
import axios, { AxiosError, AxiosHeaders } from "axios";
import { api, registrarSesionExpirada } from "./client";
beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  mocks.secure.getItemAsync.mockResolvedValue("refresh-local");
  mocks.secure.deleteItemAsync.mockResolvedValue(undefined);
  registrarSesionExpirada(null);
});
const respuesta = (status: number) => {
  const config = { url: "/auth/me", headers: new AxiosHeaders() };
  return new AxiosError("Error HTTP", "ERR_BAD_RESPONSE", config, undefined, {
    status,
    data: {},
    headers: {},
    config,
    statusText: "Error",
  });
};
it.each([429, 500, 503])(
  "conserva SecureStore y sesión ante fallo temporal %s del refresh",
  async (status) => {
    const fallo = respuesta(status);
    const expirada = vi.fn();
    registrarSesionExpirada(expirada);
    vi.spyOn(axios, "post").mockRejectedValue(fallo);
    api.defaults.adapter = async () => {
      throw respuesta(401);
    };
    await expect(api.get("/auth/me")).rejects.toBe(fallo);
    expect(mocks.secure.deleteItemAsync).not.toHaveBeenCalled();
    expect(expirada).not.toHaveBeenCalled();
  },
);
it.each([401, 403])(
  "elimina tokens y avisa cuando el refresh es rechazado con %s",
  async (status) => {
    const expirada = vi.fn();
    registrarSesionExpirada(expirada);
    vi.spyOn(axios, "post").mockRejectedValue(respuesta(status));
    api.defaults.adapter = async () => {
      throw respuesta(401);
    };
    await expect(api.get("/auth/me")).rejects.toHaveProperty(
      "response.status",
      401,
    );
    expect(mocks.secure.deleteItemAsync).toHaveBeenCalledWith(
      "escolar_refresh",
    );
    expect(mocks.secure.deleteItemAsync).toHaveBeenCalledWith("escolar_token");
    expect(expirada).toHaveBeenCalledOnce();
  },
);
it("marca pública no depende de SecureStore ni envía Authorization", async () => {
  mocks.secure.getItemAsync.mockRejectedValue(Error("Store inaccesible"));
  api.defaults.adapter = async (config) => ({
    data: {},
    status: 200,
    statusText: "OK",
    headers: {},
    config,
  });
  const r = await api.get("/configuracion/marca");
  expect(r.config.headers.Authorization).toBeUndefined();
  expect(mocks.secure.getItemAsync).not.toHaveBeenCalled();
});
it("segundo 401 revoca sin bucle de refresh", async () => {
  const expirada = vi.fn();
  registrarSesionExpirada(expirada);
  const renovar = vi.spyOn(axios, "post").mockResolvedValue({
    data: { accessToken: "nuevo", refreshToken: "rotado" },
  });
  api.defaults.adapter = async (config) => {
    throw new AxiosError(
      "No autorizado",
      "ERR_BAD_RESPONSE",
      config,
      undefined,
      { status: 401, data: {}, headers: {}, config, statusText: "Error" },
    );
  };
  await expect(api.get("/auth/me")).rejects.toHaveProperty(
    "response.status",
    401,
  );
  expect(renovar).toHaveBeenCalledOnce();
  expect(expirada).toHaveBeenCalledOnce();
});
it("una renovación tardía no restaura tokens después del logout local", async () => {
  const { eliminarTokensSesion } = await import("./client");
  let resolver!: (r: {
    data: { accessToken: string; refreshToken: string };
  }) => void;
  const renovar = vi.spyOn(axios, "post").mockImplementation(
    () =>
      new Promise((r) => {
        resolver = r;
      }),
  );
  api.defaults.adapter = async () => {
    throw respuesta(401);
  };
  const peticion = api.get("/auth/me");
  const rechazo = expect(peticion).rejects.toBeTruthy();
  await vi.waitFor(() => expect(renovar).toHaveBeenCalledOnce());
  await eliminarTokensSesion();
  resolver({ data: { accessToken: "tardio", refreshToken: "tardio" } });
  await rechazo;
  expect(mocks.secure.setItemAsync).not.toHaveBeenCalled();
});
it("una respuesta 401 de una sesión anterior no cierra la cuenta nueva", async () => {
  const { establecerTokensSesion } = await import("./client");
  const expirada = vi.fn();
  registrarSesionExpirada(expirada);
  let rechazar!: (e: unknown) => void;
  let configuracion!: import("axios").InternalAxiosRequestConfig;
  api.defaults.adapter = (config) => {
    configuracion = config;
    return new Promise((_r, reject) => {
      rechazar = reject;
    });
  };
  const peticion = api.get("/auth/me");
  const rechazo = expect(peticion).rejects.toBeTruthy();
  await vi.waitFor(() => expect(rechazar).toBeTypeOf("function"));
  await establecerTokensSesion("nueva", "nueva");
  rechazar(
    new AxiosError(
      "401 antiguo",
      "ERR_BAD_RESPONSE",
      configuracion,
      undefined,
      {
        status: 401,
        data: {},
        headers: {},
        config: configuracion,
        statusText: "Error",
      },
    ),
  );
  await rechazo;
  expect(expirada).not.toHaveBeenCalled();
  expect(mocks.secure.deleteItemAsync).not.toHaveBeenCalled();
});
