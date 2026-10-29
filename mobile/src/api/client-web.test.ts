import { expect, it, vi } from "vitest";
const memoria = vi.hoisted(() => ({
  getItemAsync: vi.fn().mockResolvedValue("acceso-ficticio"),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));
vi.mock("react-native", () => ({ Platform: { OS: "web" } }));
vi.mock("../almacen-seguro", () => memoria);
vi.mock("../biometria", () => ({ borrarPreferenciaBiometrica: vi.fn() }));
vi.mock("expo-constants", () => ({
  default: {
    expoConfig: {
      extra: { appEnv: "development", apiUrl: "http://localhost:3000/api" },
    },
  },
}));
import { api, establecerTokensSesion } from "./client";
it("usa portal WEB y cookie protegida; no persiste refresh en JavaScript", async () => {
  expect(api.defaults.headers["x-portal"]).toBe("WEB");
  expect(api.defaults.withCredentials).toBe(true);
  await establecerTokensSesion("acceso-ficticio", "no-debe-guardarse");
  expect(memoria.setItemAsync).toHaveBeenCalledWith(
    "escolar_token",
    "acceso-ficticio",
  );
  expect(memoria.setItemAsync).not.toHaveBeenCalledWith(
    "escolar_refresh",
    expect.anything(),
  );
});
