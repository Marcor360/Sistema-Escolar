import { createContext, useContext, useMemo } from "react";
import { colores, contraste, textoSobreFondo } from "./theme";
import type { Marca } from "./marca";

export type ModoAlumno = "sistema" | "claro" | "oscuro";
export type ColoresAlumno = typeof colores & {
  superficie: string;
  suave: string;
  enlace: string;
  sobrePrimario: string;
  sobrePrimarioOscuro: string;
};

export function paletaAlumno(marca: Pick<Marca, "colorPrimario" | "colorPrimarioOscuro" | "colorAcento">, oscuro: boolean): ColoresAlumno {
  // En texto corrido, usar un color de marca que alcance contraste con tarjeta y fondo.
  const papel = oscuro ? "#11191E" : colores.papel;
  const superficie = oscuro ? "#1B262D" : "#FFFFFF";
  const candidatos = oscuro
    ? [marca.colorAcento, marca.colorPrimario]
    : [marca.colorPrimario, marca.colorPrimarioOscuro];
  const enlace = candidatos.find(color => contraste(color, papel) >= 4.5 && contraste(color, superficie) >= 4.5)
    ?? (oscuro ? "#F2DDA6" : colores.tinta);
  return {
    ...colores,
    ...oscuro && {
      tinta: "#EEF3F5", gris: "#ADBCC4", linea: "#41525C",
      exito: "#87D8AD", peligro: "#FFA797", avisoTexto: "#F0D393",
    },
    papel,
    superficie,
    suave: oscuro ? "#27363F" : "#EDF2F4",
    pizarra: marca.colorPrimario,
    pizarraOscuro: marca.colorPrimarioOscuro,
    dorado: marca.colorAcento,
    sobrePrimario: textoSobreFondo(marca.colorPrimario),
    sobrePrimarioOscuro: textoSobreFondo(marca.colorPrimarioOscuro),
    enlace,
  };
}

export const TemaAlumnoContext = createContext({
  colores: paletaAlumno({ colorPrimario: colores.pizarra, colorPrimarioOscuro: colores.pizarraOscuro, colorAcento: colores.dorado }, false),
  oscuro: false,
  modo: "sistema" as ModoAlumno,
  setModo: (_modo: ModoAlumno) => {},
});

export const useTemaAlumno = () => useContext(TemaAlumnoContext);

export function useEstilosAlumno<T>(crearEstilos: (paleta: ColoresAlumno) => T): T {
  const { colores } = useTemaAlumno();
  return useMemo(() => crearEstilos(colores), [crearEstilos, colores]);
}
