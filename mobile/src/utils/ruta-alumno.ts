import type { InitialState, NavigationState } from "@react-navigation/native";
import { guardarPreferencia, leerPreferencia } from "./preferencias-web";

const secciones = ["Inicio", "Materias", "Calificaciones", "Pagos", "Perfil", "Calendario", "Tramites"];
const vistas = ["pendientes", "asistencias", "tramites", "preferencias", "sesiones"];

export function leerRutaAlumno(usuarioId: number): InitialState | undefined {
  const texto = leerPreferencia(`escolar_ruta_${usuarioId}`);
  if (!texto) return undefined;
  try {
    const { nombre, subruta, vista } = JSON.parse(texto);
    if (!secciones.includes(nombre)) return undefined;
    if (nombre === "Materias" && subruta === "MisTareas")
      return { routes: [{ name: nombre, state: { routes: [{ name: "MisMaterias" }, { name: "MisTareas" }], index: 1 } }] };
    if (nombre === "Perfil" && subruta === "MisDocumentos")
      return { routes: [{ name: nombre, state: { routes: [{ name: "MiPerfil" }, { name: "MisDocumentos" }], index: 1 } }] };
    return { routes: [{ name: nombre, ...(nombre === "Tramites" && vistas.includes(vista) && { params: { vista } }) }] };
  } catch {
    return undefined;
  }
}

export function guardarRutaAlumno(usuarioId: number, estado: NavigationState | undefined) {
  const ruta = estado?.routes[estado.index];
  if (!ruta || !secciones.includes(ruta.name)) return;
  const anidada = ruta.state;
  const subruta = anidada?.routes[anidada.index ?? 0]?.name;
  const vista = (ruta.params as { vista?: string } | undefined)?.vista;
  guardarPreferencia(`escolar_ruta_${usuarioId}`, JSON.stringify({
    nombre: ruta.name, subruta, vista: ruta.name === "Tramites" && vista && vistas.includes(vista) ? vista : undefined,
  }));
}
