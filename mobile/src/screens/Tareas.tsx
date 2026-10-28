import { useDisenoAlumno } from "../use-diseno-alumno";
import { Paginador } from "../components/Paginador";
import { crearControlLectura } from "../api/lectura-vigente";
import { validarArchivoEntrega } from "../utils/archivos-entrega";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { colores, tipografia, textoSobreFondo } from "../theme";
import { useMarca } from "../marca";
import {
  GuiaPantalla,
  base,
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
      // Evitar crear otra copia privada en caché cuando la API no está disponible.
      const { data: disponibles } = await api.get<{
        datos: Tarea[];
        total: number;
      }>("/alumnos/me/tareas/listado", { params: { pagina, porPagina: 10 } });
      if (!activa.current) return;
      const actual = disponibles.datos.find((item) => item.id === tarea.id);
      if (!actual || actual.entrega?.estatus === "CALIFICADA") {
        Alert.alert(
          "Entrega no disponible",
          "La tarea cambió. Actualiza la lista antes de seleccionar otro archivo.",
        );
        cargar();
        return;
      }
      if (!vigente()) {
        avisarDatosVencidos();
        return;
      }
      const form = new FormData();
      form.append("respuestaTexto", modo === "TEXTO" ? respuesta : "");
      if (comentarios[tarea.id]?.trim())
        form.append("comentario", comentarios[tarea.id].trim());
      if (modo === "ARCHIVO") {
        const resultado = await DocumentPicker.getDocumentAsync({
          copyToCacheDirectory: true,
        });
        if (!activa.current || resultado.canceled || !resultado.assets[0])
          return;
        if (!vigente()) {
          avisarDatosVencidos();
          return;
        }
        const archivo = resultado.assets[0];
        const problema = validarArchivoEntrega(archivo);
        if (problema) {
          Alert.alert("Archivo no válido", problema);
          return;
        }
        form.append("archivo", {
          uri: archivo.uri,
          name: archivo.name,
          type: archivo.mimeType ?? "application/octet-stream",
        } as unknown as Blob);
      }

      await api.post(`/actividades/${tarea.id}/entrega`, form, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 300_000,
      });
      if (!activa.current) return;
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
                : "Elegir nuevo archivo",
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
              detalle="Adjunta un archivo de hasta 100 MB o escribe tu respuesta (máximo 3000 caracteres). Formatos: PDF, Office, OpenDocument, imágenes, RTF, CSV, TXT, MD, ZIP, MP3, WAV, MP4 y M4A. La entrega solo queda registrada al recibir confirmación del servidor."
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
            <Vacio mensaje="Sin tareas pendientes por ahora." />
          ) : !cargaInicialCompleta && !error ? (
            <ActivityIndicator accessibilityLabel="Cargando tareas" />
          ) : null
        }
        renderItem={({ item }) => (
          <Tarjeta>
            <Text style={base.tituloTarjeta}>{item.titulo}</Text>
            {item.entrega?.comentarioDocente && (
              <Text>
                Comentarios del profesor: {item.entrega.comentarioDocente}
              </Text>
            )}
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel={`Tipo de entrega: ${item.titulo}`}
            >
              {(["ARCHIVO", "TEXTO"] as const).map((modo) => (
                <TouchableOpacity
                  key={modo}
                  accessibilityRole="radio"
                  accessibilityLabel={`${modo === "ARCHIVO" ? "Adjuntar archivo" : "Escribir respuesta"}: ${item.titulo}`}
                  accessibilityState={{
                    checked: (modos[item.id] ?? "ARCHIVO") === modo,
                    disabled:
                      entregandoId !== null ||
                      item.entrega?.estatus === "CALIFICADA",
                  }}
                  disabled={
                    entregandoId !== null ||
                    item.entrega?.estatus === "CALIFICADA"
                  }
                  style={base.botonAccesible}
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
            {modos[item.id] === "TEXTO" && (
              <>
                <TextInput
                  accessibilityLabel={`Respuesta escrita: ${item.titulo}`}
                  placeholder="Escribe tu respuesta"
                  multiline
                  maxLength={3000}
                  style={estilos.comentario}
                  editable={
                    item.entrega?.estatus !== "CALIFICADA" &&
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
            {item.entrega?.respuestaTexto && (
              <Text>Respuesta enviada: {item.entrega.respuestaTexto}</Text>
            )}
            <TextInput
              editable={
                item.entrega?.estatus !== "CALIFICADA" && entregandoId === null
              }
              accessibilityLabel={`Comentario para el profesor: ${item.titulo}`}
              placeholder="Comentario opcional para el profesor"
              multiline
              style={estilos.comentario}
              maxLength={500}
              value={comentarios[item.id] ?? ""}
              onChangeText={(texto) =>
                setComentarios((previos) => ({ ...previos, [item.id]: texto }))
              }
            />
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
            <TouchableOpacity
              style={[estilos.boton, { backgroundColor: marca.colorPrimario }]}
              onPress={() => solicitarEntrega(item)}
              disabled={
                entregandoId !== null ||
                !datosVigentes ||
                item.entrega?.estatus === "CALIFICADA"
              }
              accessibilityRole="button"
              accessibilityState={{
                disabled:
                  entregandoId !== null ||
                  !datosVigentes ||
                  item.entrega?.estatus === "CALIFICADA",
                busy: entregandoId === item.id,
              }}
              accessibilityLabel={`${item.entrega ? "Reemplazar entrega" : modos[item.id] === "TEXTO" ? "Enviar respuesta" : "Entregar archivo"}: ${item.titulo}`}
            >
              <Text
                style={[
                  estilos.botonTexto,
                  { color: textoSobreFondo(marca.colorPrimario) },
                ]}
              >
                {entregandoId === item.id
                  ? "Enviando…"
                  : item.entrega
                    ? "Reemplazar entrega"
                    : modos[item.id] === "TEXTO"
                      ? "Enviar respuesta"
                      : "Entregar archivo"}
              </Text>
            </TouchableOpacity>
          </Tarjeta>
        )}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
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
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: colores.pizarra,
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  botonTexto: { color: "#fff", fontSize: tipografia.secundaria },
});
