import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "../components/Texto";
import { colores, espacio, radio, tipografia } from "../theme";

export function GuiaPantalla({
  titulo,
  detalle,
}: {
  titulo: string;
  detalle: string;
}) {
  return (
    <View style={{ marginBottom: espacio.lg }}>
      <Text accessibilityRole="header" style={base.tituloTarjeta}>
        {titulo}
      </Text>
      <Text style={base.secundario}>{detalle}</Text>
      <Text style={base.secundario}>
        Desliza hacia abajo para actualizar. Necesitas conexión para guardar
        cambios.
      </Text>
    </View>
  );
}

export function Tarjeta({ children }: { children: React.ReactNode }) {
  return <View style={base.tarjeta}>{children}</View>;
}

export function Sello({
  texto,
  tono,
}: {
  texto: string;
  tono: "ok" | "aviso" | "mal" | "neutro";
}) {
  const color =
    tono === "ok"
      ? colores.exito
      : tono === "aviso"
        ? colores.avisoTexto
        : tono === "mal"
          ? colores.peligro
          : colores.gris;
  return (
    <Text style={[base.sello, { color, borderColor: color }]}>{texto}</Text>
  );
}

export function Vacio({ mensaje }: { mensaje: string }) {
  return <Text style={base.vacio}>{mensaje}</Text>;
}

export function ErrorCarga({
  mensaje,
  reintentar,
}: {
  mensaje: string;
  reintentar: () => void;
}) {
  return (
    <View accessibilityRole="alert" style={base.errorCarga}>
      <Text style={base.errorTexto}>{mensaje}</Text>
      <Pressable
        style={base.botonAccesible}
        onPress={reintentar}
        accessibilityRole="button"
        accessibilityLabel="Reintentar carga"
      >
        <Text style={base.reintentar}>Reintentar</Text>
      </Pressable>
    </View>
  );
}

export const base = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.papel, padding: espacio.lg },
  tarjeta: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colores.linea,
    padding: espacio.lg,
    marginBottom: espacio.md,
    borderRadius: radio.md,
  },
  tituloTarjeta: {
    fontSize: tipografia.cuerpo,
    fontWeight: "700",
    color: colores.tinta,
    marginBottom: 2,
  },
  secundario: { fontSize: tipografia.secundaria, color: colores.gris },
  sello: {
    alignSelf: "flex-start",
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radio.sm,
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginTop: 6,
  },
  vacio: {
    color: colores.gris,
    textAlign: "center",
    marginTop: 40,
    paddingHorizontal: 20,
  },
  errorCarga: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colores.peligro,
    padding: espacio.lg,
    marginBottom: espacio.md,
    borderRadius: radio.md,
  },
  errorTexto: { color: colores.peligro, marginBottom: 8 },
  reintentar: {
    color: colores.pizarra,
    textDecorationLine: "underline",
    fontWeight: "600",
  },
  botonAccesible: {
    minHeight: 44,
    justifyContent: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
  },
  monto: {
    fontVariant: ["tabular-nums"],
    fontWeight: "600",
    color: colores.tinta,
  },
});
