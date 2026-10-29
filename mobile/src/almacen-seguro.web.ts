/** Acceso solo en memoria; refresh en cookie HttpOnly del servidor. */
import type { SecureStoreOptions } from "expo-secure-store";
const memoria = new Map<string, string>();
export async function getItemAsync(
  clave: string,
  _opciones?: SecureStoreOptions,
): Promise<string | null> {
  return memoria.get(clave) ?? null;
}
export async function setItemAsync(
  clave: string,
  valor: string,
  opciones?: SecureStoreOptions,
): Promise<void> {
  if (opciones?.requireAuthentication)
    throw new Error("La biometría requiere la app instalada.");
  memoria.set(clave, valor);
}
export async function deleteItemAsync(clave: string): Promise<void> {
  memoria.delete(clave);
}
export function canUseBiometricAuthentication(): boolean {
  return false;
}
