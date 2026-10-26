import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { TouchableOpacity, View } from "react-native";
import { Text } from "./Texto";
import { api, mensajeDeError } from "../api/client";
import { base } from "../screens/comunes";
export function PendientesAlumno() {
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
        if (id === solicitud.current)
          setDatos(Array.isArray(r.data) ? r.data : []);
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
    <View>
      <Text accessibilityRole="header">Mis pendientes</Text>
      {cargando && <Text>Consultando pendientes…</Text>}
      {!!error && <Text accessibilityRole="alert">{error}</Text>}
      {datos.map((d) => (
        <Text key={d.titulo}>
          {d.titulo}: {d.cantidad}
        </Text>
      ))}
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
