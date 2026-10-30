import { abrirDocumentoFirmado } from "../api/abrir-documento-firmado";
import { useEffect, useRef, useState } from "react";
import { Alert, TextInput, TouchableOpacity, View } from "react-native";
import { Text } from "./Texto";
import { api, mensajeDeError } from "../api/client";
import { useMarca } from "../marca";
import { textoSobreFondo, colores } from "../theme";
import { base, Tarjeta } from "../screens/comunes";
interface Historial {
  id: number;
  estado: string;
  comentario: string;
  firmanteNombre: string;
  firmanteTipo: string;
  asignatura: string | null;
  fecha: string;
  vigente: boolean;
}
interface Datos {
  atencion?: { estado: string; vigente: boolean } | null;
  historialAtenciones?: {
    id: number;
    estado: string;
    responsable: string;
    comentario: string;
    fecha: string;
  }[];
  materias?: {
    grupoMateriaId: number;
    asignatura: string;
    promedioFinal: number | null;
    observaciones?: string;
  }[];
  disponible: boolean;
  versionHash: string;
  estado: string;
  historial: Historial[];
}
export function RespuestaBoleta({ inscripcionId }: { inscripcionId: number }) {
  const { marca } = useMarca();
  const [datos, setDatos] = useState<Datos | null>(null),
    [error, setError] = useState(""),
    [nombre, setNombre] = useState(""),
    [tipo, setTipo] = useState<"ALUMNO" | "TUTOR">("ALUMNO"),
    [estado, setEstado] = useState<"ACEPTADA" | "REVISION">("ACEPTADA"),
    [comentario, setComentario] = useState(""),
    [confirmado, setConfirmado] = useState(false),
    [ocupado, setOcupado] = useState(false),
    [intento, setIntento] = useState(0),
    [mensaje, setMensaje] = useState("");
  const clave = useRef(""),
    versionAnterior = useRef(""),
    bloqueo = useRef(false);
  const consultaActual = useRef(0);
  useEffect(() => {
    consultaActual.current++;
    return () => {
      consultaActual.current++;
    };
  }, [inscripcionId]);
  const descargarConstancia = async (respuestaId: number) => {
    if (bloqueo.current) return;
    bloqueo.current = true;
    setOcupado(true);
    setError("");
    const consulta = consultaActual.current;
    try {
      const r = await api.get("/reportes/mi-boleta/enlace", {
        params: {
          inscripcionId,
          respuestaId,
          formato: "constancia-aceptacion",
        },
      });
      await abrirDocumentoFirmado(
        r.data.url,
        `constancia-boleta-${respuestaId}.pdf`,
        () => consulta === consultaActual.current,
      );
    } catch (e) {
      if (consulta === consultaActual.current) setError(mensajeDeError(e));
    } finally {
      bloqueo.current = false;
      if (consulta === consultaActual.current) setOcupado(false);
    }
  };
  const nombreAtencion = (estado: string) =>
    ({
      PENDIENTE: "Pendiente",
      EN_ATENCION: "En atención",
      RESUELTA: "Resuelta",
    })[estado] ?? estado;
  // UUID compatible con Hermes y navegador a través del proveedor Expo.
  useEffect(() => {
    let vigente = true;
    setDatos(null);
    setError("");
    setConfirmado(false);
    api
      .get<Datos>(`/boletas/inscripciones/${inscripcionId}`)
      .then((r) => {
        if (vigente) {
          if (versionAnterior.current !== r.data.versionHash) {
            clave.current = "";
            versionAnterior.current = r.data.versionHash;
          }
          setDatos(r.data);
        }
      })
      .catch((e) => {
        if (vigente) setError(mensajeDeError(e));
      });
    return () => {
      vigente = false;
    };
  }, [inscripcionId, intento]);
  const guardar = async () => {
    if (
      !datos?.materias?.length ||
      bloqueo.current ||
      !datos ||
      !confirmado ||
      nombre.trim().length < 3 ||
      (estado === "REVISION" && !comentario.trim())
    )
      return;
    bloqueo.current = true;
    setOcupado(true);
    setError("");
    try {
      if (!clave.current)
        clave.current = (await import("expo-crypto")).randomUUID();
      await api.post(`/boletas/inscripciones/${inscripcionId}/responder`, {
        idempotencia: clave.current,
        versionHash: datos.versionHash,
        estado,
        firmanteNombre: nombre.trim(),
        firmanteTipo: tipo,
        comentario: estado === "REVISION" ? comentario : "",
        confirmado,
      });
      clave.current = "";
      setMensaje(
        "Firma y respuesta registradas. Se conservan su fecha y versión.",
      );
      setConfirmado(false);
      setIntento((v) => v + 1);
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      bloqueo.current = false;
      setOcupado(false);
    }
  };
  const boton = (texto: string, accion: () => void, seleccionado = false) => (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled: ocupado, selected: seleccionado }}
      disabled={ocupado}
      onPress={accion}
      style={[
        base.botonAccesible,
        {
          borderWidth: 1,
          borderColor: seleccionado ? marca.colorPrimario : colores.linea,
          borderRadius: 10,
          paddingHorizontal: 14,
          marginVertical: 5,
        },
      ]}
    >
      <Text>{texto}</Text>
    </TouchableOpacity>
  );
  return (
    <Tarjeta>
      <Text accessibilityRole="header" style={base.tituloTarjeta}>
        Aceptación y revisión de boleta
      </Text>
      {error && (
        <Text accessibilityRole="alert" style={{ color: colores.peligro }}>
          {error}
        </Text>
      )}
      {mensaje && <Text accessibilityRole="alert">{mensaje}</Text>}
      {!datos && !error && <Text>Consultando seguimiento…</Text>}
      {boton("Actualizar seguimiento", () => setIntento((v) => v + 1))}
      {datos && (
        <>
          <Text style={base.secundario}>
            {datos.estado === "ACEPTADA"
              ? "Boleta aceptada"
              : datos.estado === "REVISION"
                ? "Revisión con comentarios"
                : datos.disponible
                  ? "Pendiente de respuesta"
                  : "Pendiente de publicación"}
          </Text>
          {datos.atencion && (
            <Text>
              Atención de la revisión: {nombreAtencion(datos.atencion.estado)}
              {!datos.atencion.vigente ? " · respuesta anterior" : ""}
            </Text>
          )}
          {datos.disponible && (
            <View style={{ marginVertical: 12, gap: 8 }}>
              <Text accessibilityRole="header" style={base.tituloTarjeta}>
                Calificaciones de la versión que vas a responder
              </Text>
              {(datos.materias ?? []).map((m) => (
                <View
                  key={m.grupoMateriaId}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    gap: 12,
                    paddingVertical: 8,
                    borderBottomWidth: 1,
                    borderColor: colores.linea,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text>{m.asignatura}</Text>
                    {!!m.observaciones && (
                      <Text style={base.secundario}>{m.observaciones}</Text>
                    )}
                  </View>
                  <Text style={{ fontWeight: "700" }}>
                    {m.promedioFinal ?? "Pendiente"}
                  </Text>
                </View>
              ))}
              {!datos.materias?.length && (
                <Text>Actualiza las calificaciones antes de firmar.</Text>
              )}
            </View>
          )}
          {datos.disponible && !!datos.materias?.length && (
            <View style={{ gap: 10, marginVertical: 16 }}>
              <Text>
                Revisa las calificaciones antes de responder. La firma será tu
                nombre completo y la confirmación.
              </Text>
              {boton(
                "Aceptar calificaciones",
                () => {
                  setEstado("ACEPTADA");
                  setConfirmado(false);
                  clave.current = "";
                },
                estado === "ACEPTADA",
              )}
              {boton(
                "Revisión con comentarios",
                () => {
                  setEstado("REVISION");
                  setConfirmado(false);
                  clave.current = "";
                },
                estado === "REVISION",
              )}
              <Text>Quién firma</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                {boton(
                  "Alumno",
                  () => {
                    setTipo("ALUMNO");
                    setConfirmado(false);
                    clave.current = "";
                  },
                  tipo === "ALUMNO",
                )}
                {boton(
                  "Padre, madre o tutor",
                  () => {
                    setTipo("TUTOR");
                    setConfirmado(false);
                    clave.current = "";
                  },
                  tipo === "TUTOR",
                )}
              </View>
              <Text>Nombre completo de quien firma</Text>
              <TextInput
                accessibilityLabel="Nombre completo de quien firma"
                editable={!ocupado}
                maxLength={150}
                value={nombre}
                onChangeText={(v) => {
                  setNombre(v);
                  clave.current = "";
                }}
                style={{
                  borderWidth: 1,
                  borderColor: colores.linea,
                  borderRadius: 10,
                  padding: 12,
                  minHeight: 48,
                  backgroundColor: "white",
                  color: colores.tinta,
                }}
              />
              {estado === "REVISION" && (
                <>
                  <Text>Comentarios para revisión</Text>
                  <TextInput
                    accessibilityLabel="Comentarios para revisión"
                    editable={!ocupado}
                    multiline
                    maxLength={2000}
                    value={comentario}
                    onChangeText={(v) => {
                      setComentario(v);
                      clave.current = "";
                    }}
                    style={{
                      minHeight: 130,
                      textAlignVertical: "top",
                      borderWidth: 1,
                      borderColor: colores.linea,
                      borderRadius: 10,
                      padding: 12,
                      backgroundColor: "white",
                      color: colores.tinta,
                    }}
                  />
                  <Text style={base.secundario}>
                    {comentario.length}/2000 caracteres
                  </Text>
                </>
              )}
              {boton(
                confirmado
                  ? "Confirmación marcada: he revisado la boleta"
                  : "Confirmo que he revisado la boleta y el nombre de quien firma",
                () => setConfirmado((v) => !v),
                confirmado,
              )}
              <TouchableOpacity
                accessibilityRole="button"
                disabled={
                  ocupado ||
                  !confirmado ||
                  nombre.trim().length < 3 ||
                  (estado === "REVISION" && !comentario.trim())
                }
                accessibilityState={{
                  disabled:
                    ocupado ||
                    !confirmado ||
                    nombre.trim().length < 3 ||
                    (estado === "REVISION" && !comentario.trim()),
                  busy: ocupado,
                }}
                onPress={() =>
                  Alert.alert(
                    "Registrar respuesta",
                    "Se conservarán el nombre, la respuesta y esta versión de las calificaciones.",
                    [
                      { text: "Cancelar", style: "cancel" },
                      { text: "Registrar", onPress: () => void guardar() },
                    ],
                  )
                }
                style={{
                  minHeight: 48,
                  justifyContent: "center",
                  alignItems: "center",
                  borderRadius: 10,
                  padding: 12,
                  backgroundColor: marca.colorPrimario,
                  opacity: confirmado ? 1 : 0.65,
                }}
              >
                <Text style={{ color: textoSobreFondo(marca.colorPrimario) }}>
                  {ocupado ? "Registrando…" : "Registrar firma y respuesta"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
          <Text accessibilityRole="header" style={base.tituloTarjeta}>
            Historial y comentarios por materia
          </Text>
          {!!datos.historialAtenciones?.length && (
            <View style={{ gap: 10 }}>
              <Text accessibilityRole="header" style={base.tituloTarjeta}>
                Respuestas del personal escolar
              </Text>
              {datos.historialAtenciones.map((t) => (
                <View key={t.id} style={{ paddingVertical: 10 }}>
                  <Text>
                    {nombreAtencion(t.estado)} · responsable: {t.responsable}
                  </Text>
                  <Text>
                    {new Date(t.fecha).toLocaleString("es-MX", {
                      timeZone: "America/Mexico_City",
                    })}
                  </Text>
                  <Text>{t.comentario}</Text>
                </View>
              ))}
            </View>
          )}
          {!datos.historial.length && <Text>Sin respuestas registradas.</Text>}
          {datos.historial.map((h) => (
            <View
              key={h.id}
              style={{
                marginVertical: 10,
                padding: 12,
                borderLeftWidth: 3,
                borderColor: marca.colorPrimario,
                gap: 6,
              }}
            >
              <Text style={{ fontWeight: "700" }}>
                {h.asignatura ? `${h.asignatura} · ` : ""}
                {h.estado === "ACEPTADA"
                  ? "Boleta aceptada"
                  : h.estado === "REVISION"
                    ? "Revisión con comentarios"
                    : "Comentario docente"}
              </Text>
              <Text>
                {h.firmanteNombre} ·{" "}
                {h.firmanteTipo === "TUTOR"
                  ? "Padre, madre o tutor"
                  : h.firmanteTipo === "DOCENTE"
                    ? "Docente"
                    : "Alumno"}
              </Text>
              <Text style={base.secundario}>
                {new Date(h.fecha).toLocaleString("es-MX")}
                {!h.vigente ? " · Versión anterior" : ""}
              </Text>
              {!!h.comentario && <Text>{h.comentario}</Text>}
              {h.estado === "ACEPTADA" &&
                boton(
                  `Descargar constancia de aceptación #${h.id}`,
                  () => void descargarConstancia(h.id),
                )}
            </View>
          ))}
        </>
      )}
    </Tarjeta>
  );
}
