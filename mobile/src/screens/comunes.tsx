import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "../components/Texto";
import { colores, espacio, radio, tipografia, textoSobreFondo } from "../theme";
import { useMarca } from "../marca";

export function GuiaPantalla({
  titulo,
  detalle,
}: {
  titulo: string;
  detalle: string;
}) {
  return (
    <View style={{ marginBottom: espacio.lg }}>
      <Text accessibilityRole="header" style={base.tituloPantalla}>
        {titulo}
      </Text>
      <Text style={base.secundario}>{detalle}</Text>
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
  const { marca } = useMarca();
  return (
    <View accessibilityRole="alert" style={base.errorCarga}>
      <Text style={base.errorTexto}>{mensaje}</Text>
      <Pressable
        style={[
          base.botonAccesible,
          {
            backgroundColor: marca.colorPrimario,
            paddingHorizontal: 16,
            borderRadius: 12,
          },
        ]}
        onPress={reintentar}
        accessibilityRole="button"
        accessibilityLabel="Reintentar carga"
      >
        <Text
          style={[
            base.reintentar,
            {
              color: textoSobreFondo(marca.colorPrimario),
              textDecorationLine: "none",
            },
          ]}
        >
          Reintentar
        </Text>
      </Pressable>
    </View>
  );
}

export const base = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.papel, padding: espacio.lg },
  contenidoLista: { paddingBottom: 32 },
  tituloPantalla: {
    fontSize: 24,
    fontWeight: "700",
    color: colores.tinta,
    marginBottom: 8,
    flexShrink: 1,
  },
  tarjeta: {
    minWidth: 0,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colores.linea,
    padding: espacio.lg,
    marginBottom: espacio.md,
    borderRadius: radio.md,
  },
  tituloTarjeta: {
    fontSize: 17,
    fontWeight: "700",
    flexShrink: 1,
    color: colores.tinta,
    marginBottom: 2,
  },
  secundario: {
    fontSize: tipografia.secundaria,
    lineHeight: 20,
    color: colores.gris,
    flexShrink: 1,
  },
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
    maxWidth: "100%",
    minWidth: 44,
    paddingVertical: 8,
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
