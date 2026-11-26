import { useTemaAlumno, useEstilosAlumno, type ColoresAlumno } from "../tema-alumno";
import { useDisenoAlumno } from "../use-diseno-alumno";
import { Paginador } from "../components/Paginador";
import { crearControlLectura } from "../api/lectura-vigente";
import { validarArchivoEntrega } from "../utils/archivos-entrega";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  View,
} from "react-native";
import { Text } from "../components/Texto";
import { useFocusEffect } from "@react-navigation/native";
import * as DocumentPicker from "expo-document-picker";
import { api, mensajeDeError } from "../api/client";
import { tipografia, textoSobreFondo } from "../theme";
import { useMarca } from "../marca";
import {
  GuiaPantalla,
  useBase,
  ErrorCarga,
  Sello,
  Tarjeta,
  Vacio,
} from "./comunes";

interface Tarea {
  id: number;
  titulo: string;
  tipo: string;
  parcial: number;
  fechaEntrega: string | null;
  grupoMateria?: { materia?: { clave: string; nombre: string } };
  entrega: {
    estatus: string;
    calificacion: number | null;
    escalaMaxima?: number;
    comentarioDocente?: string | null;
    comentarioAlumno?: string | null;
    respuestaTexto?: string | null;
  } | null;
}

export default function TareasScreen() {
  const base = useBase();
  const { colores } = useTemaAlumno();
  const estilos = useEstilosAlumno(crearEstilos);
  const diseno = useDisenoAlumno();
  const { marca } = useMarca();
  const [pagina, setPagina] = useState(1),
    [total, setTotal] = useState(0);
  const [tareas, setTareas] = useState<Tarea[]>([]);
  useEffect(() => {
    setTareas([]);
    setTotal(0);
  }, [pagina]);
  const [cargando, setCargando] = useState(false);
  const [cargaInicialCompleta, setCargaInicialCompleta] = useState(false);
  const [datosVigentes, setDatosVigentes] = useState(false);
  const [fechaConsulta, setFechaConsulta] = useState(0);
  const [error, setError] = useState("");
  const [ultimaActualizacion, setUltimaActualizacion] = useState<string | null>(
    null,
  );
  const [comentarios, setComentarios] = useState<Record<number, string>>({});
  const [modos, setModos] = useState<Record<number, "ARCHIVO" | "TEXTO">>({});
  const [respuestas, setRespuestas] = useState<Record<number, string>>({});
  const [archivos, setArchivos] = useState<Record<number, DocumentPicker.DocumentPickerAsset>>({});
  const [entregandoId, setEntregandoId] = useState<number | null>(null);

  const activa = useRef(true);
  useEffect(() => {
    activa.current = true;
    return () => {
      activa.current = false;
    };
  }, []);

  useEffect(() => {
    if (!datosVigentes || !fechaConsulta) return;
    const timer = setTimeout(
      () => setDatosVigentes(false),
      Math.max(0, fechaConsulta + 5 * 60_000 - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [datosVigentes, fechaConsulta]);

  const vigencia = useRef(0);
  const vigente = () =>
    vigencia.current > 0 && Date.now() - vigencia.current < 5 * 60_000;
  const avisarDatosVencidos = () =>
    Alert.alert(
      "Actualiza tus tareas",
      "Debes actualizar tus tareas con conexión antes de entregar un archivo.",
    );
  const lectura = useRef(crearControlLectura());
  const cargar = useCallback(() => {
    setError("");
    vigencia.current = 0;
    setDatosVigentes(false);
    setCargando(true);
    void lectura.current.cargar(
      () =>
        api.get<{ datos: Tarea[]; total: number }>(
          "/alumnos/me/tareas/listado",
          { params: { pagina, porPagina: 10 } },
        ),
      (r) => {
        vigencia.current = Date.now();
        setTareas(r.data.datos);
        setTotal(r.data.total);
        setDatosVigentes(true);
        setFechaConsulta(Date.now());
        setUltimaActualizacion(new Date().toLocaleString());
        setCargaInicialCompleta(true);
      },
      (fallo) => {
        setDatosVigentes(false);
        setError(mensajeDeError(fallo));
      },
      () => setCargando(false),
    );
  }, [pagina]);

  useFocusEffect(
    useCallback(() => {
      cargar();
      return () => lectura.current.invalidar();
    }, [cargar]),
  );

  const entregaEnCurso = useRef(false);
  const comprobarDisponible = async (tarea: Tarea) => {
    // Evitar crear otra copia privada en caché cuando la API no está disponible.
    const { data: disponibles } = await api.get<{
      datos: Tarea[];
      total: number;
    }>("/alumnos/me/tareas/listado", { params: { pagina, porPagina: 10 } });
    if (!activa.current) return false;
    const actual = disponibles.datos.find((item) => item.id === tarea.id);
    if (!actual || actual.entrega?.estatus === "CALIFICADA") {
      Alert.alert(
        "Entrega no disponible",
        "La tarea cambió. Actualiza la lista antes de seleccionar otro archivo.",
      );
      cargar();
      return false;
    }
    if (!vigente()) {
      avisarDatosVencidos();
      return false;
    }
    return true;
  };
  const elegirArchivo = async (tarea: Tarea) => {
    if (entregaEnCurso.current || !vigente() || tarea.entrega?.estatus === "CALIFICADA") return;
    entregaEnCurso.current = true;
    setEntregandoId(tarea.id);
    try {
      // En web el selector necesita el gesto directo. En nativo validar antes de copiar a caché.
      if (Platform.OS !== "web" && !await comprobarDisponible(tarea)) return;
      const resultado = await DocumentPicker.getDocumentAsync({
        base64: false,
        copyToCacheDirectory: true,
      });
      if (!resultado.canceled && Platform.OS === "web" && resultado.assets[0]?.uri.startsWith("blob:")) {
        URL.revokeObjectURL(resultado.assets[0].uri);
      }
      if (!activa.current || resultado.canceled || !resultado.assets[0])
        return;
      if (!vigente()) {
        avisarDatosVencidos();
        return;
      }
      const archivo = resultado.assets[0];
      // En web usamos el File del selector, nunca una URL para descargar contenido.
      const problema = validarArchivoEntrega(Platform.OS === 'web'
        ? { name: archivo.name, size: archivo.file?.size ?? archivo.size }
        : archivo);
      if (problema) {
        Alert.alert("Archivo no válido", problema);
        return;
      }
      setArchivos(previos => ({ ...previos, [tarea.id]: archivo }));
    } catch (err) {
      if (activa.current) Alert.alert("No se pudo seleccionar el archivo", mensajeDeError(err));
    } finally {
      entregaEnCurso.current = false;
      if (activa.current) setEntregandoId(null);
    }
  };
  const entregar = async (tarea: Tarea) => {
    if (!activa.current || entregaEnCurso.current) return;
    if (!vigente()) {
      avisarDatosVencidos();
      return;
    }
    const modo = modos[tarea.id] ?? "ARCHIVO";
    const respuesta = (
      respuestas[tarea.id] ??
      tarea.entrega?.respuestaTexto ??
      ""
    ).trim();
    if (modo === "TEXTO" && (!respuesta || respuesta.length > 3000)) {
      Alert.alert("Revisa tu respuesta", "Escribe entre 1 y 3000 caracteres.");
      return;
    }
    entregaEnCurso.current = true;
    try {
      setEntregandoId(tarea.id);
      if (!await comprobarDisponible(tarea)) return;
      const form = new FormData();
      form.append("respuestaTexto", modo === "TEXTO" ? respuesta : "");
      if (comentarios[tarea.id]?.trim())
        form.append("comentario", comentarios[tarea.id].trim());
      if (modo === "ARCHIVO") {
        const archivo = archivos[tarea.id];
        if (!archivo) return;
        if (Platform.OS === 'web') {
          if (!archivo.file) {
            Alert.alert('Archivo no disponible', 'Vuelve a elegir el archivo desde este dispositivo.');
            return;
          }
          form.append('archivo', archivo.file, archivo.name);
        } else {
          form.append("archivo", {
            uri: archivo.uri,
            name: archivo.name,
            type: archivo.mimeType ?? "application/octet-stream",
          } as unknown as Blob);
        }
      }

      await api.post(`/actividades/${tarea.id}/entrega`, form, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 300_000,
      });
      if (!activa.current) return;
      setArchivos(previos => {
        const restantes = { ...previos };
        delete restantes[tarea.id];
        return restantes;
      });
      Alert.alert("Entrega enviada", `"${tarea.titulo}" quedó registrada.`);
      cargar();
    } catch (err) {
      if (activa.current)
        Alert.alert("No se pudo entregar", mensajeDeError(err));
    } finally {
      entregaEnCurso.current = false;
      if (activa.current) setEntregandoId(null);
    }
  };

  const envioBloqueado = (item: Tarea) => entregandoId !== null || !datosVigentes ||
    item.entrega?.estatus === "CALIFICADA" || (modos[item.id] !== "TEXTO" && !archivos[item.id]);

  const solicitarEntrega = (tarea: Tarea) => {
    if (entregandoId !== null) return;
    if (!vigente()) {
      avisarDatosVencidos();
      return;
    }
    if (tarea.entrega?.estatus === "CALIFICADA") {
      Alert.alert(
        "Entrega calificada",
        "La entrega ya fue evaluada y no puede reemplazarse. Consulta al docente si necesitas una corrección.",
      );
      return;
    }
    if (tarea.entrega) {
      Alert.alert(
        "Reemplazar entrega",
        modos[tarea.id] === "TEXTO"
          ? `Se actualizará la respuesta de "${tarea.titulo}". Si ya existe un adjunto, se conservará.`
          : `Se sustituirá el archivo anterior de "${tarea.titulo}". La entrega calificada no puede cambiarse.`,
        [
          { text: "Cancelar", style: "cancel" },
          {
            text:
              modos[tarea.id] === "TEXTO"
                ? "Enviar respuesta"
                : "Reemplazar archivo",
            onPress: () => {
              void entregar(tarea);
            },
          },
        ],
      );
    } else {
      void entregar(tarea);
    }
  };

  const tono = (tarea: Tarea) => {
    if (!tarea.entrega) return "neutro" as const;
    if (tarea.entrega.estatus === "CALIFICADA") return "ok" as const;
    if (tarea.entrega.estatus === "TARDE") return "mal" as const;
    return "aviso" as const;
  };

  return (
    <View style={[base.pantalla, diseno.pantalla]}>
      <FlatList
        contentContainerStyle={base.contenidoLista}
        ListHeaderComponent={
          <>
            <GuiaPantalla
              titulo="Mis tareas"
              detalle="Selecciona una tarea, adjunta un archivo de hasta 100 MB o escribe una respuesta de máximo 3000 caracteres. Revisa la fecha de entrega y espera confirmación del servidor antes de salir. Una entrega evaluada ya no puede sustituirse; su nota no equivale necesariamente a la calificación oficial de la materia."
            />
            {error !== "" && <ErrorCarga mensaje={error} reintentar={cargar} />}
            {ultimaActualizacion && (
              <Text accessibilityRole="text">
                Última actualización: {ultimaActualizacion}
              </Text>
            )}
            <TouchableOpacity
              onPress={cargar}
              disabled={cargando}
              style={base.botonAccesible}
              accessibilityLabel="Actualizar tareas"
              accessibilityRole="button"
              accessibilityState={{ disabled: cargando, busy: cargando }}
            >
              <Text style={base.secundario}>
                {cargando ? "Actualizando tareas…" : "Actualizar tareas"}
              </Text>
            </TouchableOpacity>
            {tareas.length > 0 && !datosVigentes && (
              <Text accessibilityRole="alert" style={base.secundario}>
                Los datos de tus tareas pueden estar desactualizados. Actualiza
                antes de entregar.
              </Text>
            )}
            {total > 10 && (
              <Paginador
                pagina={pagina}
                total={total}
                ocupado={cargando || entregandoId !== null}
                cambiar={setPagina}
              />
            )}
          </>
        }
        keyboardShouldPersistTaps="handled"
        data={tareas}
        keyExtractor={(t) => String(t.id)}
        refreshControl={
          <RefreshControl refreshing={cargando} onRefresh={cargar} />
        }
        ListEmptyComponent={
          cargaInicialCompleta && !error ? (
            <Vacio mensaje="No hay tareas disponibles en esta consulta. Revisa Mis materias o actualiza la lista." />
          ) : !cargaInicialCompleta && !error ? (
            <ActivityIndicator accessibilityLabel="Cargando tareas" />
          ) : null
        }
        renderItem={({ item }) => (
          <Tarjeta>
            <Text style={base.tituloTarjeta}>{item.titulo}</Text>{item.entrega?.estatus === "CALIFICADA" && <Text style={base.secundario}>Entrega evaluada. Consulta aquí la retroalimentación del docente; la nota oficial del periodo está en Calificaciones.</Text>}
            {item.entrega?.comentarioDocente && (
              <Text>
                Comentarios del profesor: {item.entrega.comentarioDocente}
              </Text>
            )}
            {item.grupoMateria?.materia && (
              <Text style={base.secundario}>
                {item.grupoMateria.materia.clave} —{" "}
                {item.grupoMateria.materia.nombre}
              </Text>
            )}
            <Text style={base.secundario}>
              {item.tipo} · Parcial {item.parcial}
              {item.fechaEntrega
                ? ` · Entrega: ${new Date(item.fechaEntrega).toLocaleString("es-MX")}`
                : ""}
            </Text>
            <Sello
              texto={
                item.entrega
                  ? `${item.entrega.estatus}${item.entrega.calificacion !== null ? ` · ${item.entrega.calificacion} / ${item.entrega.escalaMaxima ?? 100}` : ""}`
                  : "Sin entregar"
              }
              tono={tono(item)}
            />
            {item.entrega?.respuestaTexto && (
              <Text>Respuesta enviada: {item.entrega.respuestaTexto}</Text>
            )}
            {item.entrega?.estatus === "CALIFICADA" && !!item.entrega.comentarioAlumno &&
              <Text>Tu comentario: {item.entrega.comentarioAlumno}</Text>}
            {item.entrega?.estatus !== "CALIFICADA" && <>
              <View
                style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}
                accessibilityRole="radiogroup"
                accessibilityLabel={`Tipo de entrega: ${item.titulo}`}
              >
                {(["ARCHIVO", "TEXTO"] as const).map((modo) => (
                  <TouchableOpacity
                    key={modo}
                    accessibilityRole="radio" aria-checked={(modos[item.id] ?? "ARCHIVO") === modo}
                    accessibilityLabel={`${modo === "ARCHIVO" ? "Adjuntar archivo" : "Escribir respuesta"}: ${item.titulo}`}
                    accessibilityState={{
                      checked: (modos[item.id] ?? "ARCHIVO") === modo,
                      disabled:
                        entregandoId !== null,
                    }}
                    disabled={
                      entregandoId !== null
                    }
                    style={[base.botonAccesible, { borderRadius: 8, borderWidth: 1, borderColor: (modos[item.id] ?? "ARCHIVO") === modo ? colores.enlace : colores.linea }]}
                    onPress={() =>
                      setModos((previos) => ({ ...previos, [item.id]: modo }))
                    }
                  >
                    <Text>
                      {(modos[item.id] ?? "ARCHIVO") === modo ? "● " : "○ "}
                      {modo === "ARCHIVO"
                        ? "Adjuntar archivo"
                        : "Escribir respuesta"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {modos[item.id] !== "TEXTO" && <View style={{ gap: 8 }}>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${archivos[item.id] ? "Cambiar archivo" : "Cargar archivo"}: ${item.titulo}`}
                  disabled={!datosVigentes || entregandoId !== null} onPress={() => void elegirArchivo(item)}
                  style={[base.botonAccesible, { paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: colores.enlace, backgroundColor: colores.suave }]}>
                  <Text style={{color: colores.enlace, fontWeight: "700"}}>{archivos[item.id] ? "Cambiar archivo" : "Cargar archivo"}</Text>
                </TouchableOpacity>
                <Text accessibilityLiveRegion="polite" style={base.secundario}>{archivos[item.id]?.name ?? "Elige un archivo de hasta 100 MB."}</Text>
              </View>}
              {modos[item.id] === "TEXTO" && (
                <>
                  <TextInput
                    accessibilityLabel={`Respuesta escrita: ${item.titulo}`}
                    placeholder="Escribe tu respuesta"
                    placeholderTextColor={colores.gris}
                    multiline
                    maxLength={3000}
                    style={estilos.comentario}
                    editable={
                      entregandoId === null
                    }
                    value={
                      respuestas[item.id] ?? item.entrega?.respuestaTexto ?? ""
                    }
                    onChangeText={(texto) =>
                      setRespuestas((previos) => ({
                        ...previos,
                        [item.id]: texto,
                      }))
                    }
                  />
                  <Text>
                    {
                      (respuestas[item.id] ?? item.entrega?.respuestaTexto ?? "")
                        .length
                    }
                    /3000 caracteres
                  </Text>
                </>
              )}
              <TextInput
                editable={
                  entregandoId === null
                }
                accessibilityLabel={`Comentario para el profesor: ${item.titulo}`}
                placeholder="Comentario opcional para el profesor"
                placeholderTextColor={colores.gris}
                multiline
                style={estilos.comentario}
                maxLength={500}
                value={comentarios[item.id] ?? ""}
                onChangeText={(texto) =>
                  setComentarios((previos) => ({ ...previos, [item.id]: texto }))
                }
              />
              <TouchableOpacity
                style={[estilos.boton, { backgroundColor: marca.colorPrimario, opacity: envioBloqueado(item) ? 0.6 : 1 }]}
                onPress={() => solicitarEntrega(item)}
                disabled={envioBloqueado(item)}
                accessibilityRole="button"
                accessibilityState={{ disabled: envioBloqueado(item), busy: entregandoId === item.id }}
                accessibilityLabel={`${item.entrega ? "Reemplazar entrega" : modos[item.id] === "TEXTO" ? "Enviar respuesta" : "Entregar archivo"}: ${item.titulo}`}
              >
                <Text
                  style={[
                    estilos.botonTexto,
                    { color: textoSobreFondo(marca.colorPrimario) },
                  ]}
                >
                  {entregandoId === item.id
                    ? "Procesando…"
                    : item.entrega
                      ? "Reemplazar entrega"
                      : modos[item.id] === "TEXTO"
                        ? "Enviar respuesta"
                        : "Entregar archivo"}
                </Text>
              </TouchableOpacity>
            </>}
          </Tarjeta>
        )}
      />
    </View>
  );
}

const crearEstilos = (colores: ColoresAlumno) => StyleSheet.create({
  comentario: {
    borderWidth: 1,
    borderColor: colores.linea,
    borderRadius: 10,
    padding: 12,
    minHeight: 48,
    marginVertical: 8,
    color: colores.tinta,
    textAlignVertical: "top",
  },
  boton: {
    borderRadius: 8,
    alignSelf: "flex-start",
    backgroundColor: colores.pizarra,
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  botonTexto: { color: "#fff", fontSize: tipografia.secundaria },
});
