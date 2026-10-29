import { useDisenoAlumno } from "../use-diseno-alumno";
import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as SecureStore from "../almacen-seguro";
import { Text } from "../components/Texto";
import { api, mensajeDeError } from "../api/client";
import { colores, espacio, radio, tipografia, textoSobreFondo } from "../theme";
import { useMarca } from "../marca";

const ESPERA_MS = 60_000;
const CLAVE_REENVIO = "escolar_activacion_reenvio";

export default function ActivarCuentaScreen({
  volver,
  correoInicial = "",
  recuperacion = false,
}: {
  volver: () => void;
  correoInicial?: string;
  recuperacion?: boolean;
}) {
  const diseno = useDisenoAlumno();
  const { marca } = useMarca();
  const claveReenvio = recuperacion
    ? "escolar_recuperacion_reenvio"
    : CLAVE_REENVIO;
  const longitud = recuperacion ? 32 : 64;
  const [visible, setVisible] = useState(false);
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
  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const restante = Math.max(0, Math.ceil((cooldownHasta - ahora) / 1000));

  useEffect(() => {
    activa.current = true;
    const reloj = setInterval(() => setAhora(Date.now()), 1000);
    return () => {
      activa.current = false;
      clearInterval(reloj);
    };
  }, []);

  useEffect(() => {
    let vigente = true;
    setCooldownHasta(0);
    void SecureStore.getItemAsync(claveReenvio)
      .then((valor) => {
        if (!vigente || !valor) return;
        const registro: unknown = JSON.parse(valor);
        if (
          typeof registro === "object" &&
          registro !== null &&
          "email" in registro &&
          "hasta" in registro &&
          registro.email === email.trim().toLowerCase() &&
          typeof registro.hasta === "number"
        ) {
          setCooldownHasta(registro.hasta);
        }
      })
      .catch(() => undefined);
    return () => {
      vigente = false;
    };
  }, [email, claveReenvio]);

  const pedirCodigo = async () => {
    if (enCurso.current || !activa.current) return;
    if (restante > 0) {
      setPaso("codigo");
      return;
    }
    enCurso.current = true;
    setEnviando(true);
    setError("");
    setMensaje("");
    try {
      const { data } = await api.post<{ mensaje: string }>(
        recuperacion ? "/auth/forgot-password" : "/auth/solicitar-activacion",
        { email: email.trim() },
      );
      if (!activa.current) return;
      const hasta = Date.now() + ESPERA_MS;
      setAhora(Date.now());
      setCooldownHasta(hasta);
      await SecureStore.setItemAsync(
        claveReenvio,
        JSON.stringify({ email: email.trim().toLowerCase(), hasta }),
      ).catch(() => undefined);
      if (!activa.current) return;
      setMensaje(data.mensaje);
      setPaso("codigo");
    } catch (fallo) {
      if (activa.current) setError(mensajeDeError(fallo));
    } finally {
      enCurso.current = false;
      if (activa.current) setEnviando(false);
    }
  };

  const activar = async () => {
    if (enCurso.current || !activa.current) return;
    if (password !== confirmacion) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    enCurso.current = true;
    setEnviando(true);
    setError("");
    setMensaje("");
    try {
      const { data } = await api.post<{ mensaje: string }>(
        recuperacion ? "/auth/reset-password" : "/auth/activar-cuenta",
        { token: token.trim().toLowerCase(), password },
      );
      if (!activa.current) return;
      setMensaje(
        recuperacion
          ? "Tu contraseña se actualizó. Vuelve a iniciar sesión con la nueva contraseña."
          : data.mensaje,
      );
      setVisible(false);
      setToken("");
      setPassword("");
      setConfirmacion("");
      setTerminado(true);
      await SecureStore.deleteItemAsync(claveReenvio).catch(() => undefined);
    } catch (fallo) {
      if (activa.current) setError(mensajeDeError(fallo));
    } finally {
      enCurso.current = false;
      if (activa.current) setEnviando(false);
    }
  };
  const deshabilitado =
    enviando ||
    (paso === "correo"
      ? !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
      : paso === "codigo"
        ? !new RegExp(`^[a-f0-9]{${longitud}}$`).test(token)
        : password.length < 8 || !confirmacion);
  const textoBoton = enviando
    ? "Procesando…"
    : paso === "correo"
      ? "Continuar"
      : paso === "codigo"
        ? "Continuar"
        : recuperacion
          ? "Guardar nueva contraseña"
          : "Activar cuenta";

  return (
    <KeyboardAvoidingView
      style={[styles.pantalla, { backgroundColor: marca.colorPrimario }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[styles.contenido,{paddingHorizontal:diseno.lateral}]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.tarjeta,{padding:diseno.compacto?16:24}]}>
          <Text style={styles.titulo} accessibilityRole="header">
            {terminado
              ? recuperacion
                ? "Contraseña actualizada"
                : "Cuenta activada"
              : paso === "correo"
                ? recuperacion
                  ? "Recupera tu contraseña"
                  : "Activa tu cuenta"
                : paso === "codigo"
                  ? "Verifica tu correo"
                  : "Crea tu contraseña"}
          </Text>
          {!terminado && (
            <Text style={styles.texto} accessibilityLiveRegion="polite">
              Paso {paso === "correo" ? 1 : paso === "codigo" ? 2 : 3} de 3 ·{" "}
              {recuperacion
                ? "Recuperación de contraseña"
                : "Activación de cuenta"}
            </Text>
          )}
          {!terminado && (
            <Text style={styles.texto}>
              {paso === "correo"
                ? recuperacion
                  ? "Escribe tu correo institucional. Si la cuenta permite recuperar el acceso, recibirás instrucciones para cambiar tu contraseña."
                  : "Ingresa tu correo institucional para comenzar a activar tu cuenta."
                : paso === "codigo"
                  ? `Copia el código de ${longitud} caracteres del correo de ${recuperacion ? "recuperación" : "activación"}. Revisa también Correo no deseado. Vence en una hora desde la solicitud.`
                  : "Escribe una contraseña personal de al menos 8 caracteres y repítela. El código se comprobará al guardar."}
            </Text>
          )}
          {mensaje !== "" && (
            <Text accessibilityRole="alert" style={styles.texto}>
              {mensaje}
            </Text>
          )}
          {error !== "" && (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          )}
          {!terminado && paso === "correo" && (
            <>
              <Text style={styles.etiqueta}>Correo institucional</Text>
              <TextInput
                accessibilityLabel="Correo institucional"
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                editable={!enviando}
              />
            </>
          )}
          {!terminado && paso === "codigo" && (
            <>
              <Text style={styles.etiqueta}>Código de verificación</Text>
              <TextInput
                accessibilityLabel={`Código de verificación de ${longitud} caracteres`}
                style={styles.input}
                value={token}
                onChangeText={(valor) => setToken(valor.trim().toLowerCase())}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={longitud}
                editable={!enviando}
              />
              <Text style={styles.texto}>
                ¿No recibiste el código? Revisa Correo no deseado y la dirección
                escrita. Si no puedes abrir tu correo, contacta a Control
                escolar.
              </Text>
              <TouchableOpacity
                style={styles.enlace}
                onPress={() => {
                  void pedirCodigo();
                }}
                disabled={enviando || restante > 0 || !emailValido}
                accessibilityRole="button"
                accessibilityLabel={
                  restante > 0
                    ? `Solicitar otro código disponible en ${restante} segundos`
                    : "Solicitar otro código"
                }
                accessibilityState={{ disabled: enviando || restante > 0 }}
              >
                <Text
                  style={{ color: restante > 0 ? colores.gris : colores.tinta }}
                >
                  {restante > 0
                    ? `Solicitar uno nuevo en 00:${String(restante).padStart(2, "0")}`
                    : "Solicitar uno nuevo"}
                </Text>
              </TouchableOpacity>
            </>
          )}
          {!terminado && paso === "password" && (
            <>
              <Text style={styles.etiqueta}>
                Nueva contraseña (mínimo 8 caracteres)
              </Text>
              <TextInput
                accessibilityLabel="Nueva contraseña"
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!visible}
                autoComplete="new-password"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!enviando}
              />
              <Text style={styles.etiqueta}>Confirmar nueva contraseña</Text>
              <TextInput
                accessibilityLabel="Confirmar nueva contraseña"
                style={styles.input}
                value={confirmacion}
                onChangeText={setConfirmacion}
                secureTextEntry={!visible}
                autoComplete="new-password"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!enviando}
              />
            </>
          )}
          {!terminado && paso === "password" && (
            <TouchableOpacity
              style={styles.enlace}
              disabled={enviando}
              onPress={() => setVisible((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={
                visible ? "Ocultar contraseñas" : "Mostrar contraseñas"
              }
            >
              <Text>
                {visible ? "Ocultar contraseñas" : "Mostrar contraseñas"}
              </Text>
            </TouchableOpacity>
          )}
          {!terminado && paso === "correo" && (
            <TouchableOpacity
              style={styles.enlace}
              disabled={enviando}
              onPress={() => {
                setError("");
                setPaso("codigo");
              }}
              accessibilityRole="button"
              accessibilityLabel="Ya tengo un código"
            >
              <Text>Ya tengo un código</Text>
            </TouchableOpacity>
          )}
          {!terminado && paso === "codigo" && (
            <TouchableOpacity
              style={styles.enlace}
              disabled={enviando}
              onPress={() => {
                setError("");
                setMensaje("");
                setToken("");
                setPassword("");
                setConfirmacion("");
                setPaso("correo");
              }}
              accessibilityRole="button"
            >
              <Text>Revisar o cambiar correo</Text>
            </TouchableOpacity>
          )}
          {!terminado && (
            <TouchableOpacity
              style={[styles.boton, { backgroundColor: marca.colorPrimario }]}
              onPress={() => {
                if (paso === "correo") void pedirCodigo();
                else if (paso === "codigo") {
                  setError("");
                  setMensaje("");
                  setPaso("password");
                } else void activar();
              }}
              accessibilityRole="button"
              accessibilityLabel={textoBoton}
              accessibilityState={{ disabled: deshabilitado, busy: enviando }}
              disabled={deshabilitado}
            >
              <Text
                style={[
                  styles.botonTexto,
                  { color: textoSobreFondo(marca.colorPrimario) },
                ]}
              >
                {textoBoton}
              </Text>
            </TouchableOpacity>
          )}
          {!terminado && paso === "password" && (
            <TouchableOpacity
              style={styles.enlace}
              onPress={() => {
                setError("");
                setPaso("codigo");
              }}
              accessibilityRole="button"
              disabled={enviando}
            >
              <Text>Volver al código</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.enlace}
            disabled={enviando}
            onPress={volver}
            accessibilityRole="button"
            accessibilityLabel="Volver a iniciar sesión"
          >
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
  tarjeta: {
    width:"100%", maxWidth:480, alignSelf:"center",
    backgroundColor: colores.papel,
    borderRadius: radio.lg,
    padding: espacio.xl,
  },
  titulo: {
    fontSize: tipografia.titulo,
    fontWeight: "700",
    color: colores.tinta,
    marginBottom: espacio.md,
  },
  texto: {
    color: colores.gris,
    fontSize: tipografia.secundaria,
    marginBottom: espacio.md,
  },
  error: { color: colores.peligro, marginBottom: espacio.md },
  etiqueta: { color: colores.tinta, marginBottom: espacio.sm },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colores.gris,
    borderRadius: radio.sm,
    paddingHorizontal: espacio.md,
    color: colores.tinta,
    backgroundColor: colores.papel,
    marginBottom: espacio.md,
  },
  boton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colores.pizarra,
    borderRadius: radio.sm,
  },
  botonTexto: { color: colores.papel, fontWeight: "700" },
  enlace: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: espacio.sm,
  },
});
