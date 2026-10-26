import { View, TouchableOpacity } from "react-native";
import { Text } from "./Texto";
import { base } from "../screens/comunes";
export function Paginador({
  pagina,
  total,
  porPagina = 10,
  ocupado,
  cambiar,
}: {
  pagina: number;
  total: number;
  porPagina?: number;
  ocupado: boolean;
  cambiar: (p: number) => void;
}) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  return (
    <View accessibilityLabel="Paginación" style={{ gap: 8, marginBottom: 16 }}>
      <Text accessibilityLiveRegion="polite" style={base.secundario}>
        Página {pagina} de {paginas} · {total} registros
      </Text>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Página anterior"
          accessibilityState={{ disabled: ocupado || pagina <= 1 }}
          disabled={ocupado || pagina <= 1}
          onPress={() => cambiar(pagina - 1)}
          style={[
            base.tarjeta,
            {
              flex: 1,
              minWidth: 0,
              minHeight: 48,
              marginBottom: 0,
              alignItems: "center",
              justifyContent: "center",
              opacity: ocupado || pagina <= 1 ? 0.5 : 1,
            },
          ]}
        >
          <Text>Anterior</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Página siguiente"
          accessibilityState={{ disabled: ocupado || pagina >= paginas }}
          disabled={ocupado || pagina >= paginas}
          onPress={() => cambiar(pagina + 1)}
          style={[
            base.tarjeta,
            {
              flex: 1,
              minWidth: 0,
              minHeight: 48,
              marginBottom: 0,
              alignItems: "center",
              justifyContent: "center",
              opacity: ocupado || pagina >= paginas ? 0.5 : 1,
            },
          ]}
        >
          <Text>Siguiente</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
