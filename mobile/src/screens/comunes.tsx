import { useTemaAlumno, useEstilosAlumno, type ColoresAlumno } from "../tema-alumno";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "../components/Texto";
import { espacio, radio, tipografia, textoSobreFondo } from "../theme";
import { useMarca } from "../marca";
import { IconoAlumno, type NombreIconoAlumno } from '../components/IconoAlumno';

export function BannerAlumno({ titulo, detalle, icono }: { titulo: string; detalle: string; icono: NombreIconoAlumno }) {
  const { colores } = useTemaAlumno();
  return <View style={{ backgroundColor: colores.pizarraOscuro, borderRadius: 16, padding: 24, marginBottom: 26, flexDirection: 'row', alignItems: 'center', gap: 18, borderLeftWidth: 4, borderLeftColor: colores.dorado }}>
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text accessibilityRole="header" style={{ fontSize: 30, fontWeight: '700', color: colores.sobrePrimarioOscuro, marginBottom: 8 }}>{titulo}</Text>
      <Text style={{ fontSize: 15, lineHeight: 23, color: colores.sobrePrimarioOscuro }}>{detalle}</Text>
    </View>
    <IconoAlumno nombre={icono} color={colores.sobrePrimarioOscuro} tamano={34} />
  </View>;
}

export function GuiaPantalla({
  titulo,
  detalle,
}: {
  titulo: string;
  detalle: string;
}) {
  const base = useBase();
  return (
    <View style={{ marginBottom: espacio.xl }}>
      <Text accessibilityRole="header" style={base.tituloPantalla}>
        {titulo}
      </Text>
      <Text style={base.secundario}>{detalle}</Text>
    </View>
  );
}

export function Tarjeta({ children }: { children: React.ReactNode }) {
  const base = useBase();
  return <View style={base.tarjeta}>{children}</View>;
}

export function Sello({
  texto,
  tono,
}: {
  texto: string;
  tono: "ok" | "aviso" | "mal" | "neutro";
}) {
  const base = useBase();
  const { colores } = useTemaAlumno();
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
  const base = useBase();
  return <Text style={base.vacio}>{mensaje}</Text>;
}

export function ErrorCarga({
  mensaje,
  reintentar,
}: {
  mensaje: string;
  reintentar: () => void;
}) {
  const base = useBase();
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

const crearBase = (colores: ColoresAlumno) => StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.papel, padding: espacio.lg, paddingTop: espacio.xxl },
  contenidoLista: { paddingBottom: 32 },
  tituloPantalla: {
    fontSize: 30,
    fontWeight: "700",
    color: colores.tinta,
    marginBottom: 8,
    flexShrink: 1,
  },
  tarjeta: {
    gap: 10,
    minWidth: 0,
    backgroundColor: colores.superficie,
    borderWidth: 1,
    borderColor: colores.linea,
    padding: espacio.xl,
    marginBottom: espacio.lg,
    borderRadius: radio.md,
  },
  tituloTarjeta: {
    fontSize: 16,
    fontWeight: "700",
    flexShrink: 1,
    color: colores.tinta,
    marginBottom: 2,
  },
  secundario: {
    fontSize: tipografia.secundaria,
    lineHeight: 21,
    color: colores.gris,
    flexShrink: 1,
  },
  sello: {
    alignSelf: "flex-start",
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radio.sm,
    fontSize: 12,
    letterSpacing: 0.2,
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
    backgroundColor: colores.superficie,
    borderWidth: 1,
    borderColor: colores.peligro,
    padding: espacio.xl,
    marginBottom: espacio.lg,
    borderRadius: radio.md,
  },
  errorTexto: { color: colores.peligro, marginBottom: 8 },
  reintentar: {
    color: colores.enlace,
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

export const useBase = () => useEstilosAlumno(crearBase);
