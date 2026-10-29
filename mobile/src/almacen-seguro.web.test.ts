import { expect, it } from "vitest";
import {
  getItemAsync,
  setItemAsync,
  deleteItemAsync,
  canUseBiometricAuthentication,
} from "./almacen-seguro.web";
it("el navegador conserva el acceso solo en memoria y permite eliminarlo", async () => {
  await setItemAsync("token-qa", "valor-ficticio");
  expect(await getItemAsync("token-qa")).toBe("valor-ficticio");
  await deleteItemAsync("token-qa");
  expect(await getItemAsync("token-qa")).toBeNull();
  expect(canUseBiometricAuthentication()).toBe(false);
});
it("no simula autenticación biométrica en navegador", async () => {
  await expect(
    setItemAsync("biometria", "qa", { requireAuthentication: true }),
  ).rejects.toThrow("app instalada");
});
