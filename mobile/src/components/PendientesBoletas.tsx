import { useCallback, useRef, useState } from "react";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { TouchableOpacity, View } from "react-native";
import { Text } from "./Texto";
import { api, mensajeDeError } from "../api/client";
import { base, Tarjeta } from "../screens/comunes";
import { useMarca } from "../marca";
import { textoSobreFondo } from "../theme";
export function PendientesBoletas() {
  const navigation = useNavigation(),
    { marca } = useMarca(),
    turno = useRef(0);
  const [total, setTotal] = useState<number | null>(null),
    [error, setError] = useState(""),
    [cargando, setCargando] = useState(false);
  const cargar = useCallback(() => {
    const id = ++turno.current;
    setCargando(true);
    setError("");
    api
      .get("/boletas/mis-pendientes")
      .then((r) => {
        if (id === turno.current)
          setTotal(Number.isInteger(r.data.total) ? r.data.total : 0);
      })
      .catch((e) => {
        if (id === turno.current) setError(mensajeDeError(e));
      })
      .finally(() => {
        if (id === turno.current) setCargando(false);
      });
  }, []);
  useFocusEffect(
    useCallback(() => {
      cargar();
      return () => {
        turno.current++;
      };
    }, [cargar]),
  );
  return (
    <Tarjeta>
      <Text accessibilityRole="header" style={base.tituloTarjeta}>
        Mis boletas por revisar
      </Text>
      {cargando && <Text>Consultando boletas…</Text>}
      {!!error && <Text accessibilityRole="alert">{error}</Text>}
      {!cargando && !error && total !== null && (
        <Text>
          {total > 0
            ? `Tienes ${total} ${total === 1 ? "boleta pendiente" : "boletas pendientes"} de aceptación.`
            : "No tienes boletas publicadas pendientes de respuesta."}
        </Text>
      )}
      {!!total && !error && (
        <View>
          <Text>
            Revisa las calificaciones y responde con tu nombre o el de tu tutor.
            Si cambian las notas, tendrás que revisar la nueva versión.
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            style={[
              base.botonAccesible,
              {
                backgroundColor: marca.colorPrimario,
                padding: 12,
                borderRadius: 10,
              },
            ]}
            onPress={() => navigation.navigate("Calificaciones" as never)}
          >
            <Text style={{ color: textoSobreFondo(marca.colorPrimario) }}>
              Revisar mis boletas
            </Text>
          </TouchableOpacity>
        </View>
      )}
      <TouchableOpacity
        accessibilityRole="button"
        disabled={cargando}
        onPress={cargar}
        style={base.botonAccesible}
      >
        <Text>Actualizar boletas pendientes</Text>
      </TouchableOpacity>
    </Tarjeta>
  );
}
