import { useCallback, useRef, useState } from "react";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { TouchableOpacity, View } from "react-native";
import { Text } from "./Texto";
import { api, mensajeDeError } from "../api/client";
import { useMarca } from "../marca";
import { textoSobreFondo } from "../theme";
import { base } from "../screens/comunes";
export function PendientesAlumno() {
  const navigation = useNavigation();
  const { marca } = useMarca();
  const [consultado, setConsultado] = useState(false);
  const [datos, setDatos] = useState<{ titulo: string; cantidad: number }[]>(
      [],
    ),
    [error, setError] = useState(""),
    [cargando, setCargando] = useState(false);
  const solicitud = useRef(0);
  const cargar = useCallback(() => {
    const id = ++solicitud.current;
    setCargando(true);
    setError("");
    void api
      .get("/seguimiento/pendientes")
      .then((r) => {
        if (id === solicitud.current) {
          setDatos(Array.isArray(r.data) ? r.data : []);
          setConsultado(true);
        }
      })
      .catch((e) => {
        if (id === solicitud.current) setError(mensajeDeError(e));
      })
      .finally(() => {
        if (id === solicitud.current) setCargando(false);
      });
  }, []);
  useFocusEffect(
    useCallback(() => {
      cargar();
      return () => {
        solicitud.current++;
      };
    }, [cargar]),
  );
  return (
    <View style={base.tarjeta}>
      <Text accessibilityRole="header" style={base.tituloTarjeta}>
        Mis pendientes
      </Text>
      <Text style={base.secundario}>
        Primero revisa lo que requiere tu atención. Las faltas son información
        de seguimiento; no generan una sanción automática.
      </Text>
      {cargando && <Text>Consultando pendientes…</Text>}
      {!!error && <Text accessibilityRole="alert">{error}</Text>}
      {consultado &&
        !cargando &&
        !error &&
        !datos.some((d) => d.cantidad > 0) && (
          <Text>No hay pendientes señalados en esta consulta.</Text>
        )}
      {!!error && datos.length > 0 && (
        <Text>Los datos mostrados son de la consulta anterior.</Text>
      )}
      {datos.map((d) => {
        const destino =
          d.titulo === "Actividades sin entrega"
            ? "Materias"
            : d.titulo === "Cargos por cubrir"
              ? "Pagos"
              : null;
        return (
          <View
            key={d.titulo}
            style={{
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderColor: "#D8DCD6",
            }}
          >
            <Text style={base.tituloTarjeta}>
              {d.titulo}: {d.cantidad}
            </Text>
            {destino && d.cantidad > 0 && (
              <TouchableOpacity
                accessibilityRole="button"
                style={[
                  base.botonAccesible,
                  {
                    backgroundColor: marca.colorPrimario,
                    borderRadius: 10,
                    padding: 12,
                  },
                ]}
                onPress={() => navigation.navigate(destino as never)}
              >
                <Text style={{ color: textoSobreFondo(marca.colorPrimario) }}>
                  {destino === "Materias"
                    ? "Revisar mis actividades"
                    : "Revisar mi estado de cuenta"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
      <TouchableOpacity
        accessibilityRole="button"
        disabled={cargando}
        style={base.botonAccesible}
        onPress={cargar}
      >
        <Text>Actualizar pendientes</Text>
      </TouchableOpacity>
    </View>
  );
}
