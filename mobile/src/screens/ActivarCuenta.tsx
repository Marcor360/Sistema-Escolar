import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import { Text } from "../components/Texto";
import { api, mensajeDeError } from "../api/client";
import { colores, espacio, radio, tipografia } from "../theme";

export default function ActivarCuentaScreen({ volver, correoInicial = "" }: { volver: () => void; correoInicial?: string }) {
  const [paso, setPaso] = useState<"solicitar" | "activar">("solicitar");
  const [email, setEmail] = useState(correoInicial);
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [terminado, setTerminado] = useState(false);
  const enCurso = useRef(false);
  const activa = useRef(true);
  useEffect(() => () => { activa.current = false; }, []);
  const ejecutar = async () => {
    if (enCurso.current || !activa.current) return;
    enCurso.current = true;
    setEnviando(true); setError(""); setMensaje("");
    try {
      if (paso === "solicitar") {
        const { data } = await api.post<{ mensaje: string }>("/auth/solicitar-activacion", { email: email.trim() });
        if (!activa.current) return;
        setMensaje(data.mensaje);
        setPaso("activar");
      } else {
        if (password !== confirmacion) { setError("Las contraseñas no coinciden."); return; }
        const { data } = await api.post<{ mensaje: string }>("/auth/activar-cuenta", { token: token.trim().toLowerCase(), password });
        if (!activa.current) return;
        setMensaje(data.mensaje); setToken(""); setPassword(""); setConfirmacion(""); setTerminado(true);
      }
    } catch (fallo) { if (activa.current) setError(mensajeDeError(fallo)); }
    finally { enCurso.current = false; if (activa.current) setEnviando(false); }
  };
  return (
    <KeyboardAvoidingView style={styles.pantalla} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
        <View style={styles.tarjeta}>
          <Text style={styles.titulo} accessibilityRole="header">Activar mi cuenta</Text>
          <Text style={styles.texto}>
            Tu matrícula no es tu contraseña. El código de un solo uso llegará a tu correo institucional, si el servicio de correo está disponible.
          </Text>
          {mensaje !== "" && <Text accessibilityRole="alert" style={styles.texto}>{mensaje}</Text>}
          {error !== "" && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          {!terminado && paso === "solicitar" && (
            <>
              <Text style={styles.etiqueta}>Correo institucional</Text>
              <TextInput accessibilityLabel="Correo institucional" style={styles.input} value={email} onChangeText={setEmail}
                keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" editable={!enviando} />
            </>
          )}
          {!terminado && paso === "activar" && (
            <>
              <Text style={styles.etiqueta}>Código de activación</Text>
              <TextInput accessibilityLabel="Código de activación" style={styles.input} value={token} onChangeText={(valor) => setToken(valor.trim().toLowerCase())}
                autoCapitalize="none" autoCorrect={false} maxLength={64} editable={!enviando} />
              <Text style={styles.etiqueta}>Nueva contraseña (mínimo 8 caracteres)</Text>
              <TextInput accessibilityLabel="Nueva contraseña" style={styles.input} value={password} onChangeText={setPassword}
                secureTextEntry autoCapitalize="none" autoCorrect={false} editable={!enviando} />
              <Text style={styles.etiqueta}>Confirmar nueva contraseña</Text>
              <TextInput accessibilityLabel="Confirmar nueva contraseña" style={styles.input} value={confirmacion} onChangeText={setConfirmacion}
                secureTextEntry autoCapitalize="none" autoCorrect={false} editable={!enviando} />
            </>
          )}
          {!terminado && (
            <TouchableOpacity style={styles.boton} onPress={() => { void ejecutar(); }} accessibilityRole="button"
              accessibilityLabel={paso === "solicitar" ? "Solicitar código de activación" : "Activar cuenta"}
              accessibilityState={{ disabled: enviando, busy: enviando }}
              disabled={enviando || (paso === "solicitar" ? !email.trim() : token.length !== 64 || password.length < 8 || !confirmacion)}>
              <Text style={styles.botonTexto}>{enviando ? "Procesando…" : paso === "solicitar" ? "Solicitar código" : "Activar cuenta"}</Text>
            </TouchableOpacity>
          )}
          {!terminado && paso === "activar" && (
            <TouchableOpacity style={styles.enlace} disabled={enviando} onPress={() => { setPaso("solicitar"); setToken(""); }} accessibilityRole="button">
              <Text>Solicitar otro código</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.enlace} disabled={enviando} onPress={volver} accessibilityRole="button" accessibilityLabel="Volver a iniciar sesión">
            <Text>Volver a iniciar sesión</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.pizarra },
  contenido: { flexGrow: 1, justifyContent: "center", padding: espacio.lg },
  tarjeta: { backgroundColor: colores.papel, borderRadius: radio.lg, padding: espacio.xl },
  titulo: { fontSize: tipografia.titulo, fontWeight: "700", color: colores.tinta, marginBottom: espacio.md },
  texto: { color: colores.gris, fontSize: tipografia.secundaria, marginBottom: espacio.md },
  error: { color: colores.peligro, marginBottom: espacio.md },
  etiqueta: { color: colores.tinta, marginBottom: espacio.sm },
  input: { minHeight: 48, borderWidth: 1, borderColor: colores.gris, borderRadius: radio.sm, paddingHorizontal: espacio.md,
    color: colores.tinta, backgroundColor: colores.papel, marginBottom: espacio.md },
  boton: { minHeight: 48, alignItems: "center", justifyContent: "center", backgroundColor: colores.pizarra, borderRadius: radio.sm },
  botonTexto: { color: colores.papel, fontWeight: "700" },
  enlace: { minHeight: 44, alignItems: "center", justifyContent: "center", paddingTop: espacio.sm },
});
