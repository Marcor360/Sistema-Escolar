import { useEffect, useState } from "react";
import { Modal, ScrollView, TouchableOpacity, View } from "react-native";
import * as SecureStore from "expo-secure-store";
import { Text } from "./Texto";
import {
  CLAVE_GUIA_ALUMNO,
  escucharRecorridoAlumno,
  pasosAlumno,
} from "../recorrido-alumno";
import { useMarca } from "../marca";
import { textoSobreFondo } from "../theme";
export function RecorridoAlumno({
  usuarioId,
  navegar,
}: {
  usuarioId: number;
  navegar: (pantalla: (typeof pasosAlumno)[number]["pantalla"]) => void;
}) {
  const [actual, setActual] = useState<number | null>(null),
    [pausado, setPausado] = useState(false),
    [listo, setListo] = useState(false),
    [error, setError] = useState("");
  const { marca } = useMarca();
  useEffect(() => {
    let vigente = true;
    setActual(null);
    setListo(false);
    void SecureStore.getItemAsync(CLAVE_GUIA_ALUMNO + usuarioId)
      .then((v) => {
        if (vigente) {
          setActual(v === "1" ? null : 0);
          setListo(true);
        }
      })
      .catch(() => {
        if (vigente) {
          setActual(0);
          setListo(true);
        }
      });
    return () => {
      vigente = false;
    };
  }, [usuarioId]);
  useEffect(
    () =>
      escucharRecorridoAlumno(() => {
        setActual(0);
        setPausado(false);
        setListo(true);
        setError("");
      }),
    [usuarioId],
  );
  const cerrar = () => {
    setActual(null);
    void SecureStore.setItemAsync(CLAVE_GUIA_ALUMNO + usuarioId, "1").catch(
      () => setError("No se pudo recordar tu preferencia en este dispositivo."),
    );
  };
  if (!listo || actual === null) return null;
  const paso = pasosAlumno[actual];
  if (pausado)
    return (
      <View
        style={{
          position: "absolute",
          bottom: 80,
          right: 12,
          left: 12,
          padding: 10,
          backgroundColor: "#fff",
          borderRadius: 12,
          borderWidth: 1,
        }}
      >
        <TouchableOpacity
          accessibilityRole="button"
          style={{ minHeight: 48, justifyContent: "center" }}
          onPress={() => setPausado(false)}
        >
          <Text>Continuar guía: {paso.titulo}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          style={{ minHeight: 44, justifyContent: "center" }}
          onPress={cerrar}
        >
          <Text>Finalizar guía por ahora</Text>
        </TouchableOpacity>
      </View>
    );
  const boton = (texto: string, accion: () => void) => (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={accion}
      style={{
        minHeight: 48,
        padding: 12,
        marginVertical: 4,
        borderRadius: 12,
        backgroundColor: marca.colorPrimario,
      }}
    >
      <Text
        style={{
          color: textoSobreFondo(marca.colorPrimario),
          fontWeight: "700",
        }}
      >
        {texto}
      </Text>
    </TouchableOpacity>
  );
  return (
    <Modal transparent animationType="slide" visible onRequestClose={cerrar}>
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          padding: 20,
          backgroundColor: "rgba(0,0,0,.55)",
        }}
      >
        <ScrollView
          accessibilityViewIsModal
          style={{
            maxHeight: "85%",
            backgroundColor: "#fff",
            borderRadius: 20,
            padding: 20,
          }}
          contentContainerStyle={{ paddingBottom: 24 }}
        >
          <Text>
            Guía del alumno · {actual + 1} de {pasosAlumno.length}
          </Text>
          <Text
            accessibilityRole="header"
            style={{ fontSize: 23, fontWeight: "700", marginVertical: 12 }}
          >
            {paso.titulo}
          </Text>
          <Text style={{ fontSize: 16, lineHeight: 25 }}>
            {paso.descripcion}
          </Text>
          <Text style={{ fontSize: 15, lineHeight: 24, marginVertical: 12 }}>
            {paso.comprobar}
          </Text>
          {!!error && <Text accessibilityRole="alert">{error}</Text>}
          {boton("Ver esta pantalla", () => {
            navegar(paso.pantalla);
            setPausado(true);
          })}
          <Text>
            Puedes repetir la guía desde Perfil. Ningún paso guarda ni confirma
            operaciones.
          </Text>
          <View>
            {actual > 0 &&
              boton("Anterior", () => setActual((a) => (a ?? 1) - 1))}
            {boton(
              actual === pasosAlumno.length - 1
                ? "Finalizar recorrido"
                : "Siguiente",
              () =>
                actual === pasosAlumno.length - 1
                  ? cerrar()
                  : setActual((a) => (a ?? 0) + 1),
            )}
            {boton("Omitir recorrido", cerrar)}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
