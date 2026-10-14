import { activarPush, desactivarPush } from "../push";
import { crearControlLectura } from "../api/lectura-vigente";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { Text } from "../components/Texto";
import { useFocusEffect } from "@react-navigation/native";
import { api, mensajeDeError } from "../api/client";
import { useSesion } from "../sesion";
import { colores, radio, espacio, tipografia, textoSobreFondo } from "../theme";
import { base, ErrorCarga, Tarjeta } from "./comunes";

interface Perfil {
  matricula: string;
  estatus: string;
  curp: string | null;
  tutorNombre: string | null;
  usuario: {
    nombreCompleto?: string;
    nombre: string;
    apellidoPaterno: string;
    email: string;
  };
}

export default function PerfilScreen({ abrirDocumentos }: { abrirDocumentos?: () => void } = {}) {
  const { sesion, cerrar, finalizarSesionLocal } = useSesion();
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [cerrando, setCerrando] = useState(false);
  const cierreEnCurso = useRef(false);
  const pushEnCurso = useRef(false);
  const [errorPerfil, setErrorPerfil] = useState("");
  const [cargandoPerfil, setCargandoPerfil] = useState(false);
  const [cambiandoPassword, setCambiandoPassword] = useState(false);
  const cambioEnCurso = useRef(false);
  const lectura = useRef(crearControlLectura());
  const [configurandoPush, setConfigurandoPush] = useState(false);
  const configurarPush = async (activar: boolean) => {
    if (!sesion || pushEnCurso.current) return;
    pushEnCurso.current = true;
    setConfigurandoPush(true);
    try {
      if (activar) {
        const habilitado = await activarPush(sesion.sub);
        Alert.alert(
          "Notificaciones",
          habilitado
            ? "Dispositivo registrado para avisos escolares."
            : "Dispositivo registrado; falta habilitar el proveedor en el servidor.",
        );
      } else {
        await desactivarPush(sesion.sub);
        Alert.alert("Notificaciones", "Push desactivado para esta cuenta.");
      }
    } catch (error) {
      Alert.alert("Notificaciones", mensajeDeError(error));
    } finally {
      pushEnCurso.current = false;
      setConfigurandoPush(false);
    }
  };

  const cargarPerfil = useCallback(() => {
    setErrorPerfil("");
    setCargandoPerfil(true);
    void lectura.current.cargar(
      () => api.get<Perfil>("/alumnos/me/perfil"),
      (respuesta) => setPerfil(respuesta.data),
      (fallo) => {
        setPerfil(null);
        setErrorPerfil(mensajeDeError(fallo));
      },
      () => setCargandoPerfil(false),
    );
  }, []);

  const cambiarPassword = async () => {
    if (cambioEnCurso.current) return;
    if (nueva !== confirmacion) {
      Alert.alert(
        "Revisa la contraseña",
        "La nueva contraseña y su confirmación deben coincidir.",
      );
      return;
    }
    if (!actual) {
      Alert.alert("Revisa la contraseña", "Escribe tu contraseña actual.");
      return;
    }
    if (nueva.length < 8) {
      Alert.alert(
        "Revisa la contraseña",
        "La nueva contraseña debe tener al menos 8 caracteres.",
      );
      return;
    }
    cambioEnCurso.current = true;
    setCambiandoPassword(true);
    try {
      await api.post("/auth/cambiar-password", { actual, nueva });
      await finalizarSesionLocal();
      setActual("");
      setNueva("");
      setConfirmacion("");
      Alert.alert(
        "Contraseña actualizada",
        "Por seguridad, vuelve a iniciar sesión con tu nueva contraseña.",
      );
    } catch (err) {
      Alert.alert("No se pudo actualizar", mensajeDeError(err));
    } finally {
      cambioEnCurso.current = false;
      setCambiandoPassword(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      cargarPerfil();
      return () => lectura.current.invalidar();
    }, [cargarPerfil]),
  );

  return (
    <ScrollView
      style={base.pantalla}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      {errorPerfil !== "" && (
        <ErrorCarga mensaje={errorPerfil} reintentar={cargarPerfil} />
      )}
      {cargandoPerfil && !perfil && (
        <ActivityIndicator accessibilityLabel="Cargando perfil del alumno" />
      )}
      <Tarjeta>
        <Text style={base.tituloTarjeta}>{sesion?.nombre}</Text>
        <Text style={base.secundario}>{sesion?.email}</Text>
        {perfil && (
          <>
            <Text style={[base.secundario, { marginTop: 8 }]}>
              Matrícula: {perfil.matricula}
            </Text>
            {perfil.curp && (
              <Text style={base.secundario}>CURP: {perfil.curp}</Text>
            )}
            {perfil.tutorNombre && (
              <Text style={base.secundario}>Tutor: {perfil.tutorNombre}</Text>
            )}
            <Text style={base.secundario}>Estatus: {perfil.estatus}</Text>
          </>
        )}
      </Tarjeta>
      <Tarjeta>
        <Text style={base.tituloTarjeta} accessibilityRole="header">Mis documentos</Text>
        <Text style={base.secundario}>Consulta tus boletas PDF y carpetas de materiales de clase. Se descargan desde el servidor al abrirlos.</Text>
        <TouchableOpacity style={base.botonAccesible} accessibilityRole="button"
          accessibilityLabel="Ver mis documentos" onPress={abrirDocumentos}
          disabled={!abrirDocumentos}>
          <Text>Ver mis documentos y boletas</Text>
        </TouchableOpacity>
      </Tarjeta>
      <Tarjeta>
        <Text style={base.tituloTarjeta} accessibilityRole="header">
          Cambiar contraseña
        </Text>
        <Text style={base.secundario}>
          Usa una contraseña distinta de la temporal. Al guardarla se cerrará tu
          sesión y tendrás que volver a ingresar.
        </Text>
        <Text style={estilos.etiqueta}>Contraseña actual</Text>
        <TextInput
          style={estilos.input}
          secureTextEntry
          value={actual}
          onChangeText={setActual}
          accessibilityLabel="Contraseña actual"
          autoComplete="current-password"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!cambiandoPassword}
        />
        <Text style={estilos.etiqueta}>Nueva contraseña (mínimo 8)</Text>
        <TextInput
          style={estilos.input}
          secureTextEntry
          value={nueva}
          onChangeText={setNueva}
          accessibilityLabel="Nueva contraseña, mínimo 8 caracteres"
          autoComplete="new-password"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!cambiandoPassword}
        />
        <Text style={estilos.etiqueta}>Confirmar nueva contraseña</Text>
        <TextInput
          style={estilos.input}
          secureTextEntry
          value={confirmacion}
          onChangeText={setConfirmacion}
          accessibilityLabel="Confirmar nueva contraseña"
          autoComplete="new-password"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!cambiandoPassword}
        />
        <TouchableOpacity
          style={estilos.botonPrimario}
          disabled={cambiandoPassword}
          onPress={cambiarPassword}
          accessibilityRole="button"
          accessibilityState={{ disabled: cambiandoPassword }}
        >
          <Text
            style={[
              estilos.botonPrimarioTexto,
              { color: textoSobreFondo(colores.pizarra) },
            ]}
          >
            {cambiandoPassword ? "Actualizando…" : "Actualizar contraseña"}
          </Text>
        </TouchableOpacity>
      </Tarjeta>

      <Tarjeta>
        <Text accessibilityRole="header">Avisos en este dispositivo</Text>
        <Text style={base.secundario}>
          Recibe un aviso cuando haya novedades. Puedes desactivarlo aquí; tus
          avisos seguirán disponibles en Inicio.
        </Text>
        <TouchableOpacity
          style={base.botonAccesible}
          disabled={configurandoPush}
          accessibilityState={{
            disabled: configurandoPush,
            busy: configurandoPush,
          }}
          accessibilityRole="button"
          onPress={() => {
            void configurarPush(true);
          }}
        >
          <Text>Activar avisos en este dispositivo</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={base.botonAccesible}
          disabled={configurandoPush}
          accessibilityState={{
            disabled: configurandoPush,
            busy: configurandoPush,
          }}
          accessibilityRole="button"
          onPress={() => {
            void configurarPush(false);
          }}
        >
          <Text>Desactivar avisos en este dispositivo</Text>
        </TouchableOpacity>
      </Tarjeta>
      <TouchableOpacity
        style={estilos.boton}
        disabled={cerrando}
        accessibilityState={{ disabled: cerrando, busy: cerrando }}
        onPress={() => {
          Alert.alert(
            "Cerrar sesión",
            "Se cerrará tu acceso en este dispositivo. Para volver necesitarás tu correo y contraseña.",
            [
              { text: "Cancelar", style: "cancel" },
              {
                text: "Cerrar sesión",
                onPress: () => {
                  if (cierreEnCurso.current) return;
                  cierreEnCurso.current = true;
                  setCerrando(true);
                  void cerrar()
                    .catch((error: unknown) =>
                      Alert.alert(
                        "No se pudo cerrar sesión",
                        mensajeDeError(error),
                      ),
                    )
                    .finally(() => {
                      cierreEnCurso.current = false;
                      setCerrando(false);
                    });
                },
              },
            ],
          );
        }}
        accessibilityRole="button"
      >
        <Text style={estilos.botonTexto}>
          {cerrando ? "Cerrando…" : "Cerrar sesión"}
        </Text>
      </TouchableOpacity>
      <Text style={{ height: 24 }} />
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  etiqueta: {
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: colores.gris,
    marginTop: 10,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: "#B9C0BA",
    backgroundColor: "#fff",
    minHeight: 48,
    paddingHorizontal: espacio.md,
    paddingVertical: espacio.md,
    color: colores.tinta,
    borderRadius: radio.sm,
  },
  botonPrimario: {
    marginTop: 12,
    alignSelf: "flex-start",
    backgroundColor: colores.pizarra,
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: espacio.lg,
    paddingVertical: espacio.md,
    borderRadius: radio.sm,
  },
  botonPrimarioTexto: {
    color: "#fff",
    fontSize: tipografia.cuerpo,
    fontWeight: "700",
  },
  boton: {
    marginTop: 8,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colores.peligro,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  botonTexto: { color: colores.peligro, fontSize: tipografia.cuerpo },
});
