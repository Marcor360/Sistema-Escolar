import { useEffect, useRef, useState } from "react";
import { Alert, TextInput, TouchableOpacity, View } from "react-native";
import * as Crypto from "expo-crypto";
import { Text } from "./Texto";
import { api, mensajeDeError } from "../api/client";
import { base } from "../screens/comunes";
type Registro = {
  id: number;
  fecha: string;
  estado: string;
  materia: string;
  grupo: string;
};
type Tramite = {
  id: number;
  tipo: string;
  detalle: string;
  estado: string;
  revision: number;
};
type Preferencia = { tipo: string; push: boolean; correo: boolean };
type Sesion = {
  dispositivo?:string;
  id: string;
  portal: string;
  actual: boolean;
  ultimaActividadEn: string;
};
const hoy = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(
    new Date(),
  );
export function SeguimientoAlumno() {
  const [abierto, setAbierto] = useState(false);
  return (
    <View>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ expanded: abierto }}
        style={base.botonAccesible}
        onPress={() => setAbierto((a) => !a)}
      >
        <Text>
          {abierto
            ? "Cerrar seguimiento"
            : "Mis asistencias, trámites y pendientes"}
        </Text>
      </TouchableOpacity>
      {abierto && <Contenido />}
    </View>
  );
}
function Contenido() {
  const [vista, setVista] = useState("pendientes"),
    [revision, setRevision] = useState(0),
    [pagina, setPagina] = useState(1),
    [desde, setDesde] = useState(hoy().slice(0, 7) + "-01"),
    [hasta, setHasta] = useState(hoy());
  const [asistencias, setAsistencias] = useState<Registro[]>([]),
    [tramites, setTramites] = useState<Tramite[]>([]),
    [preferencias, setPreferencias] = useState<Preferencia[]>([]),
    [sesiones, setSesiones] = useState<Sesion[]>([]),
    [pendientes, setPendientes] = useState<
      { titulo: string; cantidad: number }[]
    >([]);
  const [detalle, setDetalle] = useState(""),
    [tipo, setTipo] = useState("CONSTANCIA"),
    [error, setError] = useState(""),
    [mensaje, setMensaje] = useState(""),
    [ocupado, setOcupado] = useState(false),
    [cargando, setCargando] = useState(false),
    [historial, setHistorial] = useState<{ estado: string; mensaje: string }[]>(
      [],
    );
  const clave = useRef(Crypto.randomUUID());
  const vigente = useRef(true);
  useEffect(() => { vigente.current=true; return () => {vigente.current=false;}; }, []);
  useEffect(() => {
    let activa = true;
    setCargando(true);
    setError("");
    setHistorial([]);
    const carga =
      vista === "asistencias"
        ? api
            .get("/asistencias", { params: { desde, hasta, pagina } })
            .then((r) => {
              if (activa) setAsistencias(r.data.datos);
            })
        : vista === "tramites"
          ? api.get("/seguimiento/tramites").then((r) => {
              if (activa) setTramites(r.data);
            })
          : vista === "preferencias"
            ? api.get("/seguimiento/preferencias").then((r) => {
                if (activa) setPreferencias(r.data);
              })
            : vista === "sesiones"
              ? api.get("/seguimiento/sesiones").then((r) => {
                  if (activa) setSesiones(r.data);
                })
              : api.get("/seguimiento/pendientes").then((r) => {
                  if (activa) setPendientes(r.data);
                });
    void carga
      .catch((e) => {
        if (activa) setError(mensajeDeError(e));
      })
      .finally(() => {
        if (activa) setCargando(false);
      });
    return () => {
      activa = false;
    };
  }, [vista, revision, desde, hasta, pagina]);
  const ejecutar = async (accion: () => Promise<unknown>) => {
    if (ocupado) return;
    setOcupado(true);
    setError("");
    setMensaje("");
    try {
      await accion();
      if (vigente.current) {
        setMensaje("Operación guardada");
        setRevision((r) => r + 1);
      }
    } catch (e) {
      if (vigente.current) setError(mensajeDeError(e));
    } finally {
      if (vigente.current) setOcupado(false);
    }
  };
  const boton = (titulo: string, accion: () => void, deshabilitado = false) => (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled: deshabilitado }}
      style={base.botonAccesible}
      disabled={deshabilitado}
      onPress={accion}
    >
      <Text>{titulo}</Text>
    </TouchableOpacity>
  );
  return (
    <View>
      <Text accessibilityRole="header">Mi seguimiento escolar</Text>
      {[
        "pendientes",
        "asistencias",
        "tramites",
        "preferencias",
        "sesiones",
      ].map((v) => (
        <View key={v}>
          {boton(
            v === "tramites"
              ? "Trámites"
              : v === "sesiones"
                ? "Sesiones abiertas"
                : v === "preferencias"
                  ? "Preferencias de avisos"
                  : v === "asistencias"
                    ? "Mis asistencias"
                    : "Mis pendientes",
            () => setVista(v),
            ocupado,
          )}
        </View>
      ))}
      {cargando && <Text accessibilityRole="alert">Consultando…</Text>}
      {!!error && <Text accessibilityRole="alert">{error}</Text>}
      {!!mensaje && <Text>{mensaje}</Text>}
      {boton(
        "Actualizar / reintentar",
        () => setRevision((r) => r + 1),
        ocupado || cargando,
      )}
      {vista === "pendientes" &&
        pendientes.map((p) => (
          <Text key={p.titulo}>
            {p.titulo}: {p.cantidad}
          </Text>
        ))}
      {vista === "asistencias" && (
        <>
          <Text>
            Solo se muestran tus registros. No modifican tus calificaciones.
          </Text>
          <Text>Desde (AAAA-MM-DD)</Text>
          <TextInput
            accessibilityLabel="Desde"
            value={desde}
            onChangeText={(v) => {
              setDesde(v);
              setPagina(1);
            }}
          />
          <Text>Hasta (AAAA-MM-DD)</Text>
          <TextInput
            accessibilityLabel="Hasta"
            value={hasta}
            onChangeText={(v) => {
              setHasta(v);
              setPagina(1);
            }}
          />
          {asistencias.map((a) => (
            <Text key={a.id}>
              {a.fecha} · {a.grupo} · {a.materia}: {a.estado}
            </Text>
          ))}
          {!cargando && !asistencias.length && (
            <Text>No hay registros en este intervalo.</Text>
          )}
          {boton(
            "Página anterior",
            () => setPagina((p) => p - 1),
            pagina === 1,
          )}
          <Text>Página {pagina}</Text>
          {boton(
            "Página siguiente",
            () => setPagina((p) => p + 1),
            asistencias.length < 100,
          )}
        </>
      )}
      {vista === "tramites" && (
        <>
          <Text>Solicitar un trámite</Text>
          {["CONSTANCIA", "CORRECCION", "DOCUMENTO"].map((t) => (
            <View key={t}>
              {boton((tipo === t ? "✓ " : "") + t, () => setTipo(t), ocupado)}
            </View>
          ))}
          <TextInput
            accessibilityLabel="Detalle de la solicitud"
            placeholder="Describe lo que necesitas"
            multiline
            maxLength={600}
            editable={!ocupado}
            value={detalle}
            onChangeText={setDetalle}
          />
          {boton(
            "Enviar solicitud",
            () =>
              void ejecutar(async () => {
                await api.post("/seguimiento/tramites", {
                  clave: clave.current,
                  tipo,
                  detalle,
                });
                clave.current = Crypto.randomUUID();
                if (vigente.current) setDetalle("");
              }),
            ocupado || detalle.trim().length < 5,
          )}
          {tramites.map((t) => (
            <View key={t.id}>
              <Text>
                Folio #{t.id} · {t.tipo} · {t.estado}
              </Text>
              <Text>{t.detalle}</Text>
              {boton("Consultar seguimiento del folio " + t.id, () => {
                void api
                  .get("/seguimiento/tramites/" + t.id + "/historial")
                  .then((r) => {
                    if (vigente.current) setHistorial(r.data);
                  })
                  .catch((e) => {
                    if (vigente.current) setError(mensajeDeError(e));
                  });
              })}
              {t.estado === "SOLICITADO" &&
                boton(
                  "Cancelar solicitud " + t.id,
                  () =>
                    Alert.alert(
                      "Cancelar solicitud",
                      "¿Cancelar el folio #" + t.id + "?",
                      [
                        { text: "Conservar", style: "cancel" },
                        {
                          text: "Cancelar solicitud",
                          onPress: () =>
                            void ejecutar(() =>
                              api.patch("/seguimiento/tramites/" + t.id, {
                                revision: t.revision,
                                estado: "CANCELADO",
                                mensaje: "Cancelado por el alumno",
                              }),
                            ),
                        },
                      ],
                    ),
                  ocupado,
                )}
            </View>
          ))}
          {historial.map((h, i) => (
            <Text key={i}>
              {h.estado}: {h.mensaje}
            </Text>
          ))}
        </>
      )}
      {vista === "preferencias" && (
        <>
          <Text>
            Los avisos permanecen en tu bandeja. Los correos de seguridad
            siempre están habilitados.
          </Text>
          {preferencias.map((p) => (
            <View key={p.tipo}>
              <Text>{p.tipo}</Text>
              {(["push", "correo"] as const).map((c) => (
                <View key={c}>
                  {boton(
                    (c === "push" ? "Dispositivo" : "Correo opcional") +
                      ": " +
                      (p[c] ? "Activado" : "Desactivado"),
                    () =>
                      setPreferencias((ps) =>
                        ps.map((x) =>
                          x.tipo === p.tipo ? { ...x, [c]: !x[c] } : x,
                        ),
                      ),
                    ocupado,
                  )}
                </View>
              ))}
            </View>
          ))}
          {boton(
            "Guardar preferencias",
            () =>
              void ejecutar(() =>
                api.patch("/seguimiento/preferencias", { preferencias }),
              ),
            ocupado || !preferencias.length,
          )}
        </>
      )}
      {vista === "sesiones" &&
        sesiones.map((s) => (
          <View key={s.id}>
            <Text>
              {s.dispositivo??'Dispositivo no identificado'} · {s.portal} · Última actividad:{" "}
              {s.ultimaActividadEn
                ? new Date(s.ultimaActividadEn).toLocaleString("es-MX")
                : "Sin actividad"}{" "}
              {s.actual ? "· Esta sesión" : ""}
            </Text>
            {!s.actual &&
              boton(
                "Cerrar sesión remota",
                () =>
                  Alert.alert("Cerrar sesión remota", "¿Revocar esta sesión?", [
                    { text: "Conservar", style: "cancel" },
                    {
                      text: "Cerrar sesión",
                      onPress: () =>
                        void ejecutar(() =>
                          api.delete("/seguimiento/sesiones/" + s.id),
                        ),
                    },
                  ]),
                ocupado,
              )}
          </View>
        ))}
    </View>
  );
}
