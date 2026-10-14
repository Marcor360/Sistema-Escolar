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
    comentarioDocente?: string | null;
    comentarioAlumno?: string | null;
  } | null;
}

export default function TareasScreen() {
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [cargando, setCargando] = useState(false);
  const [cargaInicialCompleta, setCargaInicialCompleta] = useState(false);
  const [error, setError] = useState("");
  const [ultimaActualizacion, setUltimaActualizacion] = useState<string | null>(
    null,
  );
  const [comentarios, setComentarios] = useState<Record<number, string>>({});
  const [entregandoId, setEntregandoId] = useState<number | null>(null);

  const activa = useRef(true);
  useEffect(() => {
    activa.current = true;
    return () => {
      activa.current = false;
    };
  }, []);

  const lectura = useRef(crearControlLectura());
  const cargar = useCallback(() => {
    setError("");
    setCargando(true);
    void lectura.current.cargar(
      () => api.get<Tarea[]>("/alumnos/me/tareas"),
      (r) => {
        setTareas(r.data);
        setUltimaActualizacion(new Date().toLocaleString());
        setCargaInicialCompleta(true);
      },
      (fallo) => setError(mensajeDeError(fallo)),
      () => setCargando(false),
    );
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar();
      return () => lectura.current.invalidar();
    }, [cargar]),
  );

  const entregaEnCurso = useRef(false);
  const entregar = async (tarea: Tarea) => {
    if (!activa.current || entregaEnCurso.current) return;
    entregaEnCurso.current = true;
    try {
      setEntregandoId(tarea.id);
      const resultado = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
      });
      if (!activa.current || resultado.canceled || !resultado.assets[0]) return;
      const archivo = resultado.assets[0];
      const problema = validarArchivoEntrega(archivo);
      if (problema) {
        Alert.alert("Archivo no válido", problema);
        return;
      }

      const form = new FormData();
      if (comentarios[tarea.id]?.trim())
        form.append("comentario", comentarios[tarea.id].trim());
      form.append("archivo", {
        uri: archivo.uri,
        name: archivo.name,
        type: archivo.mimeType ?? "application/octet-stream",
      } as unknown as Blob);

      await api.post(`/actividades/${tarea.id}/entrega`, form, {
        headers: { "Content-Type": "multipart/form-data" },
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
        `Se sustituirá el archivo anterior de "${tarea.titulo}". La entrega calificada no puede cambiarse.`,
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Elegir nuevo archivo",
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
    <View style={base.pantalla}>
      {error !== "" && <ErrorCarga mensaje={error} reintentar={cargar} />}
      {ultimaActualizacion && (
        <Text accessibilityRole="text">
          Última actualización: {ultimaActualizacion}
        </Text>
      )}
      <FlatList
        ListHeaderComponent={
          <GuiaPantalla
            titulo="Mis tareas"
            detalle="Adjunta un PDF, documento de Office, imagen, ZIP o TXT (límite preliminar de 5 MB). La entrega solo queda registrada al recibir confirmación del servidor."
          />
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
                  ? `${item.entrega.estatus}${item.entrega.calificacion !== null ? ` · ${item.entrega.calificacion}` : ""}`
                  : "Sin entregar"
              }
              tono={tono(item)}
            />
            <TouchableOpacity
              style={estilos.boton}
              onPress={() => solicitarEntrega(item)}
              disabled={
                entregandoId !== null || item.entrega?.estatus === "CALIFICADA"
              }
              accessibilityRole="button"
              accessibilityState={{
                disabled:
                  entregandoId !== null ||
                  item.entrega?.estatus === "CALIFICADA",
                busy: entregandoId === item.id,
              }}
              accessibilityLabel={`${item.entrega ? "Reemplazar entrega" : "Entregar archivo"}: ${item.titulo}`}
            >
              <Text
                style={[
                  estilos.botonTexto,
                  { color: textoSobreFondo(colores.pizarra) },
                ]}
              >
                {entregandoId === item.id
                  ? "Enviando…"
                  : item.entrega
                    ? "Reemplazar entrega"
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
