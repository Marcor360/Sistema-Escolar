import { activarPush, desactivarPush } from "../push";
import { habilitarBiometria, borrarPreferenciaBiometrica, preferenciaBiometrica, biometriaDisponible } from "../biometria";
import { crearControlLectura } from "../api/lectura-vigente";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
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
import { useMarca } from "../marca";
import { colores, radio, espacio, tipografia, textoSobreFondo } from "../theme";
import { base, ErrorCarga, Tarjeta } from "./comunes";
import { ocultarCurp } from "../utils/curp-privada";

interface Perfil {
  matricula: string;
  estatus: string;
  curp: string | null;
  tutorNombre: string | null;
  tutorTelefono: string | null;
  fechaNacimiento: string | null;
  direccion: string | null;
  usuario: {
    correoPersonal: string | null;
    telefono: string | null;
    nombreCompleto?: string;
    nombre: string;
    apellidoPaterno: string;
    email: string;
  };
}

export default function PerfilScreen({ abrirDocumentos }: { abrirDocumentos?: () => void } = {}) {
  const { marca } = useMarca();
  const { sesion, cerrar, finalizarSesionLocal } = useSesion();
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [bioDisponible] = useState(() => biometriaDisponible());
  const [bioActiva, setBioActiva] = useState(false);
  const [bioEnCurso, setBioEnCurso] = useState(false);
  useEffect(() => {
    let vigente = true;
    void preferenciaBiometrica().then((id) => {
      if (vigente) setBioActiva(id === sesion?.sub);
    }).catch(() => { if (vigente) setBioActiva(false); });
    return () => { vigente = false; };
  }, [sesion?.sub]);
  const configurarBiometria = async () => {
    if (!sesion || bioEnCurso) return;
    setBioEnCurso(true);
    try {
      if (bioActiva) {
        await borrarPreferenciaBiometrica();
        setBioActiva(false);
        Alert.alert("Acceso biométrico", "Se desactivó el acceso con huella o rostro.");
      } else {
        await habilitarBiometria(sesion.sub);
        setBioActiva(true);
        Alert.alert("Acceso biométrico", "Se protegerá el acceso al abrir de nuevo la aplicación mientras tu sesión siga vigente.");
      }
    } catch (error) {
      Alert.alert("Acceso biométrico", mensajeDeError(error));
    } finally { setBioEnCurso(false); }
  };
  const [edicion, setEdicion] = useState<{
    correoPersonal: string; telefono: string; fechaNacimiento: string;
    tutorNombre: string; tutorTelefono: string; direccion: string;
  } | null>(null);
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);
  const [errorEdicion, setErrorEdicion] = useState("");
  const guardarPerfil = async () => {
    if (!edicion || guardandoPerfil) return;
    setGuardandoPerfil(true);
    setErrorEdicion("");
    try {
      const { data } = await api.patch<Perfil>("/alumnos/me/perfil", {
        correoPersonal: edicion.correoPersonal.trim() || null,
        telefono: edicion.telefono.trim() || null,
        fechaNacimiento: edicion.fechaNacimiento.trim() || null,
        tutorNombre: edicion.tutorNombre.trim() || null,
        tutorTelefono: edicion.tutorTelefono.trim() || null,
        direccion: edicion.direccion.trim() || null,
      });
      setPerfil(data);
      setEdicion(null);
      Alert.alert("Información actualizada", "Tus datos personales se guardaron correctamente.");
    } catch (error) {
      setErrorEdicion(mensajeDeError(error));
    } finally {
      setGuardandoPerfil(false);
    }
  };
  const [mostrarCurp, setMostrarCurp] = useState(false);
  useEffect(() => {
    if (!mostrarCurp) return;
    const timer = setTimeout(() => setMostrarCurp(false), 30_000);
    return () => clearTimeout(timer);
  }, [mostrarCurp]);
  useEffect(() => {
    const listener = AppState.addEventListener("change", (estado) => { if (estado !== "active") setMostrarCurp(false); });
    return () => listener.remove();
  }, []);
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
    setMostrarCurp(false);
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
      return () => { setMostrarCurp(false); lectura.current.invalidar(); };
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
              <>
                <Text style={base.secundario}>CURP: {mostrarCurp ? perfil.curp : ocultarCurp(perfil.curp)}</Text>
                <TouchableOpacity style={base.botonAccesible} accessibilityRole="button"
                  accessibilityLabel={mostrarCurp ? "Ocultar CURP" : "Mostrar CURP completa"}
                  accessibilityState={{ expanded: mostrarCurp }}
                  onPress={() => setMostrarCurp((actual) => !actual)}>
                  <Text>{mostrarCurp ? "Ocultar CURP" : "Mostrar mi CURP"}</Text>
                </TouchableOpacity>
              </>
            )}
            {perfil.tutorNombre && (
              <Text style={base.secundario}>Tutor: {perfil.tutorNombre}</Text>
            )}
            <Text style={base.secundario}>Estatus: {perfil.estatus}</Text>
            <Text style={base.secundario}>Correo personal: {perfil.usuario?.correoPersonal || "Sin registrar"}</Text>
            <Text style={base.secundario}>Teléfono: {perfil.usuario?.telefono || "Sin registrar"}</Text>
            <Text style={base.secundario}>Nacimiento: {perfil.fechaNacimiento || "Sin registrar"}</Text>
            <Text style={base.secundario}>Teléfono del tutor: {perfil.tutorTelefono || "Sin registrar"}</Text>
            <Text style={base.secundario}>Dirección: {perfil.direccion || "Sin registrar"}</Text>
          </>
        )}
      </Tarjeta>
      {perfil && <Tarjeta>
        <Text style={base.tituloTarjeta} accessibilityRole="header">Mis datos de contacto</Text>
        <Text style={base.secundario}>Puedes corregir estos datos. Tu nombre, matrícula, CURP y correo institucional no se pueden cambiar aquí.</Text>
        {edicion === null
          ? <TouchableOpacity style={base.botonAccesible} accessibilityRole="button"
              accessibilityLabel="Editar mis datos de contacto" onPress={() => {
                setErrorEdicion("");
                setEdicion({
                  correoPersonal: perfil.usuario?.correoPersonal || "",
                  telefono: perfil.usuario?.telefono || "",
                  fechaNacimiento: perfil.fechaNacimiento || "",
                  tutorNombre: perfil.tutorNombre || "",
                  tutorTelefono: perfil.tutorTelefono || "",
                  direccion: perfil.direccion || "",
                });
              }}>
              <Text>Editar mis datos de contacto</Text>
            </TouchableOpacity>
          : <>
              {([
                ["correoPersonal", "Correo personal", "email-address", 120, false],
                ["fechaNacimiento", "Fecha de nacimiento (AAAA-MM-DD)", "numbers-and-punctuation", 10, false],
                ["telefono", "Teléfono", "phone-pad", 20, false],
                ["tutorNombre", "Nombre del tutor", "default", 120, false],
                ["tutorTelefono", "Teléfono del tutor", "phone-pad", 20, false],
                ["direccion", "Dirección", "default", 200, true],
              ] as const).map(([campo, etiqueta, teclado, maximo, multilinea]) => (
                <TextInput key={campo} style={estilos.input} accessibilityLabel={etiqueta}
                  placeholder={etiqueta} placeholderTextColor={colores.gris} value={edicion[campo]}
                  onChangeText={(valor) => setEdicion((anterior) => anterior && { ...anterior, [campo]: valor })}
                  keyboardType={teclado} maxLength={maximo} multiline={multilinea}
                  autoCapitalize={campo === "correoPersonal" ? "none" : "sentences"}
                  autoCorrect={campo !== "correoPersonal"} editable={!guardandoPerfil}
                />
              ))}
              {errorEdicion ? <Text style={{ color: colores.peligro }} accessibilityRole="alert">{errorEdicion}</Text> : null}
              <TouchableOpacity style={estilos.botonPrimario} accessibilityRole="button"
                disabled={guardandoPerfil} accessibilityState={{ busy: guardandoPerfil, disabled: guardandoPerfil }}
                onPress={() => { void guardarPerfil(); }}>
                <Text style={[estilos.botonPrimarioTexto, { color: textoSobreFondo(marca.colorPrimario) }]}>{guardandoPerfil ? "Guardando…" : "Guardar mis datos"}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={base.botonAccesible} accessibilityRole="button"
                disabled={guardandoPerfil} onPress={() => setEdicion(null)}>
                <Text>Cancelar</Text>
              </TouchableOpacity>
            </>
        }
      </Tarjeta>}
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
          style={[estilos.botonPrimario, { backgroundColor: marca.colorPrimario }]}
          disabled={cambiandoPassword}
          onPress={cambiarPassword}
          accessibilityRole="button"
          accessibilityLabel="Actualizar contraseña"
          accessibilityState={{ disabled: cambiandoPassword }}
        >
          <Text
            style={[
              estilos.botonPrimarioTexto,
              { color: textoSobreFondo(marca.colorPrimario) },
            ]}
          >
            {cambiandoPassword ? "Actualizando…" : "Actualizar contraseña"}
          </Text>
        </TouchableOpacity>
      </Tarjeta>

      <Tarjeta>
        <Text accessibilityRole="header" style={base.tituloTarjeta}>🔐 Acceso rápido y privado</Text>
        <Text style={base.secundario}>
          {bioDisponible
            ? "Usa la huella o el rostro configurados en el teléfono para desbloquear tu sesión. No guardamos datos biométricos ni contraseñas."
            : "Este teléfono no tiene autenticación biométrica compatible y configurada."}
        </Text>
        <TouchableOpacity style={base.botonAccesible} accessibilityRole="button"
          accessibilityLabel={bioActiva ? "Desactivar acceso biométrico" : "Activar acceso biométrico"}
          accessibilityState={{ disabled: !bioDisponible || bioEnCurso, busy: bioEnCurso }}
          disabled={!bioDisponible || bioEnCurso}
          onPress={() => { void configurarBiometria(); }}>
          <Text>{bioEnCurso ? "Comprobando…" : bioActiva ? "Desactivar acceso biométrico" : "Activar acceso con huella o rostro"}</Text>
        </TouchableOpacity>
        <Text style={base.secundario}>Al cerrar sesión se eliminan los tokens, preferencias y la caché de tu cuenta. El acceso biométrico no prolonga el límite de 30 minutos sin actividad.</Text>
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
            "Se eliminarán tus datos temporales y el acceso biométrico de este dispositivo. Para volver necesitarás tu correo y contraseña.",
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
      <Text style={base.secundario}>
        Por seguridad, tu sesión se cerrará después de 30 minutos sin actividad.
      </Text>
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
