import { useState } from "react";
import { Image, View } from "react-native";
import { archivosBase } from "../api/client";
import { useMarca } from "../marca";
import { useTemaAlumno } from "../tema-alumno";
import { Text } from "./Texto";

export function LogoInstitucional({ cabecera = false }: { cabecera?: boolean }) {
  const { marca } = useMarca();
  const { colores } = useTemaAlumno();
  const [errores, setErrores] = useState<string[]>([]);
  const candidatos = [marca.logoAlumnoUrl, marca.logoUrl];
  const logo = candidatos.find(url => url && !errores.includes(url));
  const grande = marca.tamanoLogo === "GRANDE";
  return (
    <View style={{
      alignItems: "center", justifyContent: "center", alignSelf: "center",
      backgroundColor: colores.pizarraOscuro, borderColor: colores.linea, borderWidth: 1,
      borderRadius: 10, paddingVertical: cabecera ? 4 : 8, paddingHorizontal: 8,
    }}>
      {logo ? <Image key={logo} source={{ uri: archivosBase + logo }} resizeMode="contain"
        style={{ width: cabecera ? (grande ? 94 : 72) : (grande ? 192 : 150), height: cabecera ? (grande ? 52 : 44) : (grande ? 94 : 72) }}
        accessibilityLabel={`Logo de ${marca.nombreInstitucion}`}
        onError={() => setErrores(previos => [...previos, logo])} />
        : <Text style={{ fontSize: cabecera ? 19 : 26, fontWeight: "800", color: colores.sobrePrimarioOscuro }}>{marca.nombreCorto}</Text>}
    </View>
  );
}
