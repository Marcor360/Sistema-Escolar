import { Linking, Platform } from "react-native";
import { archivosBase } from "./client";
import { resolverEnlacePrivado } from "./enlaces-privados";
/** La URL se valida antes de abrir; el navegador descarga sin adjuntar credenciales. */
export async function abrirDocumentoFirmado(
  ruta: string,
  nombre: string,
  vigente = () => true,
) {
  const enlace = resolverEnlacePrivado(archivosBase, ruta, "boleta");
  if (!vigente()) return;
  if (Platform.OS !== "web") {
    await Linking.openURL(enlace);
    return;
  }
  const respuesta = await fetch(enlace, {
    credentials: "omit",
    referrerPolicy: "no-referrer",
  });
  if (!respuesta.ok)
    throw new Error(
      "No se pudo descargar el documento. Actualiza la pantalla e intenta nuevamente.",
    );
  if (!vigente()) return;
  const blob = await respuesta.blob();
  if (!vigente()) return;
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
