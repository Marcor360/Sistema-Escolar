import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import * as SecureStore from "expo-secure-store";
import { Text } from "../components/Texto";
import { api, mensajeDeError } from "../api/client";
import { colores, espacio, radio, tipografia, textoSobreFondo } from "../theme";
import { useMarca } from "../marca";

const ESPERA_MS = 60_000;
const CLAVE_REENVIO = "escolar_activacion_reenvio";

export default function ActivarCuentaScreen({ volver, correoInicial = "" }: { volver: () => void; correoInicial?: string }) {
  const { marca } = useMarca();
  const [paso, setPaso] = useState<"correo" | "codigo" | "password">("correo");
  const [email, setEmail] = useState(correoInicial);
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [terminado, setTerminado] = useState(false);
  const [cooldownHasta, setCooldownHasta] = useState(0);
  const [ahora, setAhora] = useState(Date.now());
  const enCurso = useRef(false);
  const activa = useRef(true);
  const restante = Math.max(0, Math.ceil((cooldownHasta - ahora) / 1000));

  useEffect(() => {
    activa.current = true;
    const reloj = setInterval(() => setAhora(Date.now()), 1000);
    return () => { activa.current = false; clearInterval(reloj); };
  }, []);

  useEffect(() => {
    let vigente = true;
    void SecureStore.getItemAsync(CLAVE_REENVIO).then(valor => {
      if (!vigente || !valor) return;
      const registro: unknown = JSON.parse(valor);
      if (typeof registro === "object" && registro !== null && "email" in registro && "hasta" in registro
        && registro.email === email.trim().toLowerCase() && typeof registro.hasta === "number") {
        setCooldownHasta(registro.hasta);
      }
    }).catch(() => undefined);
    return () => { vigente = false; };
  }, [email]);

  const pedirCodigo = async () => {
    if (enCurso.current || !activa.current || (paso !== "correo" && restante > 0)) return;
    enCurso.current = true;
    setEnviando(true); setError(""); setMensaje("");
    try {
      const { data } = await api.post<{ mensaje: string }>("/auth/solicitar-activacion", { email: email.trim() });
      if (!activa.current) return;
      const hasta = Date.now() + ESPERA_MS;
      setAhora(Date.now());
      setCooldownHasta(hasta);
      await SecureStore.setItemAsync(CLAVE_REENVIO, JSON.stringify({ email: email.trim().toLowerCase(), hasta }));
      if (!activa.current) return;
      setMensaje(data.mensaje);
      setPaso("codigo");
    } catch (fallo) { if (activa.current) setError(mensajeDeError(fallo)); }
    finally { enCurso.current = false; if (activa.current) setEnviando(false); }
  };

  const activar = async () => {
    if (enCurso.current || !activa.current) return;
    if (password !== confirmacion) { setError("Las contraseñas no coinciden."); return; }
    enCurso.current = true;
    setEnviando(true); setError(""); setMensaje("");
    try {
      const { data } = await api.post<{ mensaje: string }>("/auth/activar-cuenta", { token: token.trim().toLowerCase(), password });
      if (!activa.current) return;
      setMensaje(data.mensaje);
      setToken(""); setPassword(""); setConfirmacion(""); setTerminado(true);
      await SecureStore.deleteItemAsync(CLAVE_REENVIO).catch(() => undefined);
    } catch (fallo) { if (activa.current) setError(mensajeDeError(fallo)); }
    finally { enCurso.current = false; if (activa.current) setEnviando(false); }
  };
  const deshabilitado = enviando || (paso === "correo" ? !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email.trim())
    : paso === "codigo" ? !/^[a-f0-9]{64}$/.test(token) : password.length < 8 || !confirmacion);
  const textoBoton = enviando ? "Procesando…" : paso === "correo" ? "Continuar" : paso === "codigo" ? "Continuar" : "Activar cuenta";

  return (
    <KeyboardAvoidingView style={[styles.pantalla, { backgroundColor: marca.colorPrimario }]} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
        <View style={styles.tarjeta}>
          <Text style={styles.titulo} accessibilityRole="header">{terminado ? "Cuenta activada" : paso === "correo" ? "Activa tu cuenta" : paso === "codigo" ? "Verifica tu correo" : "Crea tu contraseña"}</Text>
          {!terminado && <Text style={styles.texto}>
            {paso === "correo" ? "Ingresa tu correo institucional para comenzar a activar tu cuenta."
              : paso === "codigo" ? "Ingresa el código que te llegó a tu correo institucional. Puede tardar unos minutos."
                : "Crea una contraseña personal. El código se comprobará al activar tu cuenta."}
          </Text>}
          {mensaje !== "" && <Text accessibilityRole="alert" style={styles.texto}>{mensaje}</Text>}
          {error !== "" && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          {!terminado && paso === "correo" && <>
            <Text style={styles.etiqueta}>Correo institucional</Text>
            <TextInput accessibilityLabel="Correo institucional" style={styles.input} value={email} onChangeText={setEmail}
              keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" editable={!enviando} />
          </>}
          {!terminado && paso === "codigo" && <>
            <Text style={styles.etiqueta}>Código de verificación</Text>
            <TextInput accessibilityLabel="Código de verificación de 64 caracteres" style={styles.input} value={token}
              onChangeText={valor => setToken(valor.trim().toLowerCase())} autoCapitalize="none"
              autoCorrect={false} maxLength={64} editable={!enviando} />
            <Text style={styles.texto}>¿No recibiste el código?</Text>
            <TouchableOpacity style={styles.enlace} onPress={() => { void pedirCodigo(); }}
              disabled={enviando || restante > 0} accessibilityRole="button"
              accessibilityLabel={restante > 0 ? `Solicitar otro código disponible en ${restante} segundos` : "Solicitar otro código"}
              accessibilityState={{ disabled: enviando || restante > 0 }}>
              <Text style={{ color: restante > 0 ? colores.gris : colores.tinta }}>
                {restante > 0 ? `Solicitar uno nuevo en 00:${String(restante).padStart(2, "0")}` : "Solicitar uno nuevo"}
              </Text>
            </TouchableOpacity>
          </>}
          {!terminado && paso === "password" && <>
            <Text style={styles.etiqueta}>Nueva contraseña (mínimo 8 caracteres)</Text>
            <TextInput accessibilityLabel="Nueva contraseña" style={styles.input} value={password}
              onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} editable={!enviando} />
            <Text style={styles.etiqueta}>Confirmar nueva contraseña</Text>
            <TextInput accessibilityLabel="Confirmar nueva contraseña" style={styles.input} value={confirmacion}
              onChangeText={setConfirmacion} secureTextEntry autoCapitalize="none" autoCorrect={false} editable={!enviando} />
          </>}
          {!terminado && <TouchableOpacity style={[styles.boton, { backgroundColor: marca.colorPrimario }]}
            onPress={() => { if (paso === "correo") void pedirCodigo(); else if (paso === "codigo") { setError(""); setMensaje(""); setPaso("password"); } else void activar(); }}
            accessibilityRole="button" accessibilityLabel={textoBoton}
            accessibilityState={{ disabled: deshabilitado, busy: enviando }} disabled={deshabilitado}>
            <Text style={[styles.botonTexto, { color: textoSobreFondo(marca.colorPrimario) }]}>{textoBoton}</Text>
          </TouchableOpacity>}
          {!terminado && paso === "password" && <TouchableOpacity style={styles.enlace} onPress={() => setPaso("codigo")}
            accessibilityRole="button" disabled={enviando}><Text>Volver al código</Text></TouchableOpacity>}
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
