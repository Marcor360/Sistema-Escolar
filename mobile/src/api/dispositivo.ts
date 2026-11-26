import { Platform } from "react-native";
import { randomUUID } from "expo-crypto";
import * as SecureStore from "../almacen-seguro";

const CLAVE = "escolar_dispositivo";
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function obtenerDispositivoId() {
  try {
    if (Platform.OS === "web") {
      const guardado = localStorage.getItem(CLAVE);
      if (guardado && UUID_V4.test(guardado)) return guardado;
      const nuevo = randomUUID();
      localStorage.setItem(CLAVE, nuevo);
      return nuevo;
    }
    const guardado = await SecureStore.getItemAsync(CLAVE);
    if (guardado && UUID_V4.test(guardado)) return guardado;
    const nuevo = randomUUID();
    await SecureStore.setItemAsync(CLAVE, nuevo);
    return nuevo;
  } catch {
    return undefined;
  }
}
