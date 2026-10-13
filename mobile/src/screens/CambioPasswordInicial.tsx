import { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { Text } from "../components/Texto";
import { mensajeDeError } from "../api/errores";
import { colores, textoSobreFondo } from "../theme";
import { base, Tarjeta } from "./comunes";

export default function CambioPasswordInicial({
  guardar,
}: {
  guardar: (actual: string, nueva: string) => Promise<void>;
}) {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [error, setError] = useState("");
  const [cambiando, setCambiando] = useState(false);
  const enCurso = useRef(false);
  const cambiar = async () => {
    if (enCurso.current) return;
    if (!actual || nueva.length < 8 || nueva !== confirmacion) {
      setError(
        "Escribe tu contraseña temporal y una nueva de al menos 8 caracteres. Confirma la nueva contraseña sin diferencias.",
      );
      return;
    }
    enCurso.current = true;
    setCambiando(true);
    setError("");
    try {
      await guardar(actual, nueva);
      setActual("");
      setNueva("");
      setConfirmacion("");
    } catch (fallo) {
      setError(mensajeDeError(fallo));
    } finally {
      enCurso.current = false;
      setCambiando(false);
    }
  };
  const input = {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colores.linea,
    borderRadius: 10,
    padding: 12,
    marginVertical: 8,
    color: colores.tinta,
  };
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={base.pantalla}
        contentContainerStyle={{ paddingTop: 40, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <Tarjeta>
          <Text accessibilityRole="header" style={base.tituloTarjeta}>
            Protege tu cuenta
          </Text>
          <Text style={base.secundario}>
            Cambia tu contraseña temporal antes de consultar tus datos. Después
            tendrás que ingresar de nuevo con tu nueva contraseña.
          </Text>
          <Text>Contraseña temporal</Text>
          <TextInput
            style={input}
            accessibilityLabel="Contraseña temporal"
            secureTextEntry
            value={actual}
            onChangeText={setActual}
            editable={!cambiando}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="current-password"
          />
          <Text>Nueva contraseña (mínimo 8 caracteres)</Text>
          <TextInput
            style={input}
            accessibilityLabel="Nueva contraseña"
            secureTextEntry
            value={nueva}
            onChangeText={setNueva}
            editable={!cambiando}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
          />
          <Text>Confirmar nueva contraseña</Text>
          <TextInput
            style={input}
            accessibilityLabel="Confirmar nueva contraseña"
            secureTextEntry
            value={confirmacion}
            onChangeText={setConfirmacion}
            editable={!cambiando}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
          />
          {error !== "" && (
            <Text accessibilityRole="alert" style={{ color: colores.peligro }}>
              {error}
            </Text>
          )}
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Cambiar contraseña y volver a ingresar"
            accessibilityState={{ disabled: cambiando, busy: cambiando }}
            disabled={cambiando}
            onPress={() => {
              void cambiar();
            }}
            style={{
              minHeight: 48,
              justifyContent: "center",
              padding: 12,
              borderRadius: 10,
              marginTop: 12,
              backgroundColor: colores.pizarra,
            }}
          >
            <Text style={{ color: textoSobreFondo(colores.pizarra) }}>
              {cambiando
                ? "Guardando…"
                : "Cambiar contraseña y volver a ingresar"}
            </Text>
          </TouchableOpacity>
        </Tarjeta>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
