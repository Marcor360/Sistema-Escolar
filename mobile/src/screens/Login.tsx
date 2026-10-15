import { useRef, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "../components/Texto";
import { useSesion } from "../sesion";
import { archivosBase, mensajeDeError } from "../api/client";
import { colores, radio, espacio, tipografia, textoSobreFondo } from "../theme";
import { useMarca } from "../marca";
import ActivarCuentaScreen from "./ActivarCuenta";

export default function LoginScreen({ aviso = "" }: { aviso?: string } = {}) {
  const { iniciar } = useSesion();
  const { marca } = useMarca();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const enCurso = useRef(false);
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [logoFallo, setLogoFallo] = useState(false);
  const [activacionVisible, setActivacionVisible] = useState(false);

  const entrar = async () => {
    if (enCurso.current || !email.trim() || !password) return;
    enCurso.current = true;
    setError("");
    setEnviando(true);
    try {
      await iniciar(email.trim(), password);
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      enCurso.current = false;
      setEnviando(false);
    }
  };

  if (activacionVisible) return <ActivarCuentaScreen correoInicial={email} volver={() => setActivacionVisible(false)} />;

  return (
    <KeyboardAvoidingView
      style={[estilos.fondo, { backgroundColor: marca.colorPrimario }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={estilos.desplazamiento}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[estilos.caja, { borderTopColor: marca.colorAcento }]}>
          {marca.logoUrl && !logoFallo ? (
            <Image
              source={{ uri: archivosBase + marca.logoUrl }}
              style={estilos.logo}
              resizeMode="contain"
              onError={() => setLogoFallo(true)}
              accessibilityLabel={marca.nombreInstitucion}
            />
          ) : (
            <View
              style={[estilos.monograma, { borderColor: marca.colorPrimario }]}
            >
              <Text
                style={[estilos.monogramaTexto, { color: marca.colorPrimario }]}
              >
                {marca.nombreCorto}
              </Text>
            </View>
          )}
          <Text style={estilos.titulo} accessibilityRole="header">
            {marca.nombreInstitucion}
          </Text>
          <Text style={estilos.descripcion}>
            App del alumno: consulta materias, entrega tareas y revisa tus
            calificaciones y pagos. Ingresa con tu correo institucional.
          </Text>
          {aviso !== "" && <Text accessibilityRole="alert" style={estilos.ayuda}>{aviso}</Text>}
          <Text style={estilos.etiqueta}>Correo institucional</Text>
          <TextInput
            style={estilos.input}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            accessibilityLabel="Correo institucional"
            autoComplete="email"
            autoCorrect={false}
            editable={!enviando}
            returnKeyType="next"
          />
          <Text style={estilos.etiqueta}>Contraseña</Text>
          <TextInput
            style={estilos.input}
            secureTextEntry={!mostrarPassword}
            value={password}
            onChangeText={setPassword}
            accessibilityLabel="Contraseña"
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!enviando}
            returnKeyType="go"
            onSubmitEditing={() => {
              void entrar();
            }}
          />
          <TouchableOpacity
            style={estilos.controlPassword}
            onPress={() => setMostrarPassword((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={
              mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"
            }
            accessibilityState={{ expanded: mostrarPassword }}
          >
            <Text>
              {mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            </Text>
          </TouchableOpacity>
          {error !== "" && (
            <Text style={estilos.error} accessibilityRole="alert">
              {error}
            </Text>
          )}
          <TouchableOpacity
            style={[estilos.boton, { backgroundColor: marca.colorPrimario }]}
            onPress={entrar}
            disabled={enviando || !email.trim() || !password}
            accessibilityRole="button"
            accessibilityLabel={
              enviando ? "Verificando credenciales" : "Entrar"
            }
            accessibilityState={{
              disabled: enviando || !email.trim() || !password,
            }}
          >
            <Text
              style={[
                estilos.botonTexto,
                { color: textoSobreFondo(marca.colorPrimario) },
              ]}
            >
              {enviando ? "Verificando…" : "Entrar"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={estilos.controlPassword} onPress={() => setActivacionVisible(true)} accessibilityRole="button" accessibilityLabel="Activar mi cuenta por primera vez">
            <Text>Activar mi cuenta por primera vez</Text>
          </TouchableOpacity>
          <Text style={estilos.ayuda}>
            Si no tienes acceso o necesitas recuperar tu contraseña, contacta a
            control escolar. El personal utiliza el portal web.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: colores.pizarra },
  desplazamiento: {
    flexGrow: 1,
    justifyContent: "center",
    padding: espacio.lg,
    paddingVertical: espacio.xxl,
  },
  controlPassword: {
    minHeight: 44,
    justifyContent: "center",
    marginBottom: espacio.sm,
  },
  ayuda: {
    color: colores.gris,
    fontSize: tipografia.secundaria,
    marginTop: espacio.lg,
  },
  caja: {
    backgroundColor: colores.papel,
    padding: espacio.xl,
    borderTopWidth: 4,
    borderTopColor: colores.dorado,
    borderRadius: radio.lg,
  },
  monograma: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: colores.pizarra,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  monogramaTexto: { fontSize: 18, color: colores.pizarra, fontWeight: "600" },
  logo: { width: 160, height: 72, alignSelf: "center", marginBottom: 10 },
  titulo: {
    fontSize: tipografia.titulo,
    textAlign: "center",
    marginBottom: 4,
    color: colores.tinta,
    fontWeight: "700",
  },
  descripcion: {
    fontSize: tipografia.secundaria,
    textAlign: "center",
    color: colores.gris,
    marginBottom: espacio.xl,
  },
  etiqueta: {
    fontSize: tipografia.secundaria,
    color: colores.gris,
    marginBottom: espacio.sm,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderColor: "#B9C0BA",
    backgroundColor: "#fff",
    minHeight: 48,
    paddingHorizontal: espacio.md,
    paddingVertical: espacio.sm,
    marginBottom: espacio.lg,
    color: colores.tinta,
    borderRadius: radio.sm,
    fontSize: tipografia.cuerpo,
  },
  error: { color: colores.peligro, marginBottom: 10 },
  boton: {
    minHeight: 48,
    backgroundColor: colores.pizarra,
    paddingVertical: espacio.md,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radio.sm,
  },
  botonTexto: { color: "#fff", fontSize: tipografia.cuerpo, fontWeight: "700" },
});
