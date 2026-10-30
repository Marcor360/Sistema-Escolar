import { useEffect, useState } from "react";
import { Image, ScrollView, View, TouchableOpacity } from "react-native";
import { Text } from "./Texto";
import { api, archivosBase, mensajeDeError } from "../api/client";
import { base } from "../screens/comunes";
import { diaCalendarioEscolar, eventosDelDia, mesInicialCalendario } from "../utils/calendario-escolar";
import { colores, radio, espacio } from "../theme";

type Ciclo = {
  id: number;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  activo: boolean;
};
type Evento = {
  id: number;
  titulo: string;
  fechaInicio: string;
  fechaFin: string | null;
  imagenNombre: string | null;
};
const dia = diaCalendarioEscolar;
function ImagenCiclo({ evento }: { evento: Evento }) {
  const [url, setUrl] = useState("");
  const [cargando,setCargando]=useState(true),[intento,setIntento]=useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    let vigente = true;
    setUrl("");setError("");setCargando(true);
    api
      .get<{ url: string }>(`/archivos/calendario/${evento.id}/enlace`)
      .then(({ data }) => {
        if (vigente) setUrl(archivosBase + data.url);
      })
      .catch((e) => {
        if (vigente) { setError(mensajeDeError(e)); setCargando(false); }
      });
    return () => {
      vigente = false;
    };
  }, [evento.id,evento.imagenNombre,intento]);
  return (
    <View>
      <Text>{evento.titulo}</Text>
      {url && (
        <Image
          source={{ uri: url }}
          style={{ width: "100%", height: 450 }}
          resizeMode="contain"
          accessibilityLabel={evento.titulo}
          onLoad={()=>setCargando(false)}
          onError={() => {setCargando(false);
            setError(
              "No se pudo mostrar la imagen. Puedes reintentar la carga.",
            );}}
        />
      )}
      {cargando&&<Text>Cargando imagen…</Text>}
      {!!error && <><Text accessibilityRole="alert">{error}</Text><TouchableOpacity accessibilityRole="button" style={base.botonAccesible} onPress={()=>setIntento(i=>i+1)}><Text>Reintentar imagen</Text></TouchableOpacity></>}
    </View>
  );
}
export function CalendarioCiclo() {
  const [abierto, setAbierto] = useState(false);
  return (
    <View>
      <TouchableOpacity
        style={base.botonAccesible}
        accessibilityRole="button"
        accessibilityState={{ expanded: abierto }}
        onPress={() => setAbierto((v) => !v)}
      >
        <Text>
          {abierto
            ? "Ocultar calendario institucional"
            : "Ver calendario institucional"}
        </Text>
      </TouchableOpacity>
      {abierto && <ContenidoCalendario />}
    </View>
  );
}
function ContenidoCalendario() {
  const [ciclos, setCiclos] = useState<Ciclo[]>([]);
  const [seleccion, setSeleccion] = useState(0);
  const [mes, setMes] = useState("");
  const [diaSeleccionado, setDiaSeleccionado] = useState("");
  const [ambito, setAmbito] = useState<"CONSOLIDADO" | "GLOBAL">("CONSOLIDADO");
  const [vista, setVista] = useState<"mes" | "ciclo" | "imagen" | "agenda">("mes");
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let vigente = true;
    api
      .get<{ ciclos: Ciclo[] }>("/calendario/opciones")
      .then(({ data }) => {
        if (vigente) {
          setCiclos(data.ciclos);
          setSeleccion(
            data.ciclos.find((c) => c.activo)?.id ?? data.ciclos[0]?.id ?? 0,
          );
          setCargando(false);
        }
      })
      .catch((e) => {
        if (vigente) {
          setError(mensajeDeError(e));
          setCargando(false);
        }
      });
    return () => {
      vigente = false;
    };
  }, [revision]);
  const ciclo = ciclos.find((c) => c.id === seleccion);
  useEffect(() => {
    if (!ciclo) return;
    let vigente = true;
    const hoyEscolar = dia(new Date().toISOString());
    setMes(mesInicialCalendario(ciclo.fechaInicio, ciclo.fechaFin, hoyEscolar));
    setDiaSeleccionado(hoyEscolar >= ciclo.fechaInicio && hoyEscolar <= ciclo.fechaFin ? hoyEscolar : ciclo.fechaInicio);
    setError("");
    setCargando(true);
    setEventos([]);
    void (async () => {
      const encontrados = new Map<number, Evento>();
      const fin = new Date(ciclo.fechaFin + "T23:59:59-06:00").getTime();
      let desde = new Date(ciclo.fechaInicio + "T00:00:00-06:00").getTime();
      while (desde <= fin && vigente) {
        const hasta = Math.min(fin, desde + 365 * 86400000);
        const { data } = await api.get<Evento[]>("/calendario", {
          params: {
            cicloId: ciclo.id,
            ambito,
            desde: new Date(desde).toISOString(),
            hasta: new Date(hasta).toISOString(),
          },
        });
        data.forEach((e) => encontrados.set(e.id, e));
        desde = hasta + 1;
      }
      if (vigente) setEventos([...encontrados.values()]);
    })()
      .catch((e) => {
        if (vigente) setError(mensajeDeError(e));
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [ciclo, revision, ambito]);
  const meses: string[] = [];
  if (ciclo) {
    let d = new Date(ciclo.fechaInicio.slice(0, 7) + "-01T12:00:00Z");
    while (d.toISOString().slice(0, 7) <= ciclo.fechaFin.slice(0, 7)) {
      meses.push(d.toISOString().slice(0, 7));
      d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 12));
    }
  }
  return (
    <View>
      <Text accessibilityRole="header">Calendario del ciclo escolar</Text>
      {ciclos.length === 1 && <Text>{ciclos[0].nombre}</Text>}
      {ciclos.length > 1 && ciclos.map((c) => (
        <TouchableOpacity
          key={c.id}
          accessibilityRole="button"
          accessibilityState={{ selected: c.id === seleccion }}
          style={base.botonAccesible}
          onPress={() => setSeleccion(c.id)}
        >
          <Text>
            {c.id === seleccion ? "✓ " : ""}
            {c.nombre}
          </Text>
        </TouchableOpacity>
      ))}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: espacio.sm, marginVertical: espacio.md }}>
        {(["CONSOLIDADO", "GLOBAL"] as const).map((opcion) => (
          <TouchableOpacity key={opcion} accessibilityRole="button"
            accessibilityLabel={opcion === "CONSOLIDADO" ? "Eventos institucionales y de mi plantel" : "Solo eventos institucionales"}
            accessibilityState={{ selected: ambito === opcion }}
            style={[base.botonAccesible, { borderWidth: 1, borderColor: colores.linea, borderRadius: radio.sm, backgroundColor: ambito === opcion ? colores.papel : "#fff" }]}
            onPress={() => setAmbito(opcion)}>
            <Text>{opcion === "CONSOLIDADO" ? "Mi plantel e institucional" : "Solo institucional"}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: espacio.sm }}>
      {(["mes", "ciclo", "imagen", "agenda"] as const).map((v) => (
        <TouchableOpacity
          key={v}
          accessibilityRole="button"
          accessibilityState={{ selected: vista === v }}
          style={base.botonAccesible}
          onPress={() => setVista(v)}
        >
          <Text>
            {v === "mes"
              ? "Mes"
              : v === "ciclo"
                ? "Ciclo completo"
                : v === "agenda" ? "Agenda accesible" : "Imagen institucional"}
          </Text>
        </TouchableOpacity>
      ))}
      </View>
      {cargando && <Text>Cargando calendario…</Text>}
      {!!error && (
        <View accessibilityRole="alert">
          <Text>{error}</Text>
          <TouchableOpacity
            accessibilityRole="button"
            style={base.botonAccesible}
            onPress={() => setRevision((r) => r + 1)}
          >
            <Text>Reintentar</Text>
          </TouchableOpacity>
        </View>
      )}
      {!cargando && !ciclos.length && !error && (
        <Text>No hay ciclos escolares disponibles.</Text>
      )}
      {!cargando && !error && (vista === "imagen" ? (
        <>
          {eventos
            .filter((e) => e.imagenNombre)
            .map((e) => (
              <ImagenCiclo key={e.id} evento={e} />
            ))}
          {!cargando && !eventos.some((e) => e.imagenNombre) && (
            <Text>No hay imagen publicada para tu nivel.</Text>
          )}
        </>
      ) : vista === "agenda" ? <View>{eventos.filter(e => !e.imagenNombre).length === 0 ? <Text>No hay eventos en la agenda de este ciclo.</Text> : eventos.filter(e => !e.imagenNombre).map(e => <View key={e.id} style={{ paddingVertical: espacio.md, borderBottomWidth: 1, borderColor: colores.linea }}><Text>{dia(e.fechaInicio)}{e.fechaFin ? ' — ' + dia(e.fechaFin) : ''}: {e.titulo}</Text></View>)}</View> : (
        <>
          {vista === "mes" && (
            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              <TouchableOpacity
                accessibilityRole="button"
                style={base.botonAccesible}
                disabled={meses.indexOf(mes) <= 0}
                onPress={() => {setMes(meses[meses.indexOf(mes) - 1]); setDiaSeleccionado("");}}
              >
                <Text>Mes anterior</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                style={base.botonAccesible}
                disabled={meses.indexOf(mes) >= meses.length - 1}
                onPress={() => {setMes(meses[meses.indexOf(mes) + 1]); setDiaSeleccionado("");}}
              >
                <Text>Mes siguiente</Text>
              </TouchableOpacity>
            </View>
          )}
          {(vista === "mes" ? [mes] : meses).filter(Boolean).map((m) => {
            const [a, n] = m.split("-").map(Number);
            const dias = new Date(Date.UTC(a, n, 0)).getUTCDate();
            const offset =
              (new Date(Date.UTC(a, n - 1, 1)).getUTCDay() + 6) % 7;
            return (
              <View key={m} style={{ marginVertical: 12 }}>
                <Text accessibilityRole="header">
                  {new Intl.DateTimeFormat("es-MX", {
                    month: "long",
                    year: "numeric",
                    timeZone: "UTC",
                  }).format(new Date(m + "-01T12:00:00Z"))}
                </Text>
                <ScrollView horizontal nestedScrollEnabled contentContainerStyle={{ minWidth: 336, flexGrow: 1 }}>
                <View style={{ flexDirection: "row", flexWrap: "wrap", width: "100%" }}>
                  {["L", "M", "X", "J", "V", "S", "D"].map((d, i) => (
                    <Text key={"d" + i} style={{ width: "14.28%" }}>
                      {d}
                    </Text>
                  ))}
                  {Array.from({ length: offset }, (_, i) => (
                    <View key={"b" + i} style={{ width: "14.28%" }} />
                  ))}
                  {Array.from({ length: dias }, (_, i) => {
                    const fecha = m + "-" + String(i + 1).padStart(2, "0");
                    const eventosDia = eventosDelDia(eventos, fecha);
                    return (
                      <TouchableOpacity
                        key={fecha}
                        accessibilityRole="button"
                        accessibilityLabel={`${fecha}: ${eventosDia.length} evento(s)`}
                        accessibilityState={{ selected: diaSeleccionado === fecha }}
                        onPress={() => setDiaSeleccionado(fecha)}
                        style={{
                          width: "14.28%",
                          minHeight: 52,
                          padding: 4,
                          borderWidth: 1,
                          borderColor: diaSeleccionado === fecha ? colores.pizarra : colores.linea,
                          backgroundColor: diaSeleccionado === fecha ? colores.papel : "#fff",
                        }}
                      >
                        <Text>{i + 1}</Text>
                        {eventosDia.length > 0 && <Text style={{ fontSize: 12, color: colores.pizarra }}>{eventosDia.length} evento(s)</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </View>
                </ScrollView>
                {vista === "mes" && <View style={{ marginTop: espacio.md, padding: espacio.md, backgroundColor: "#fff", borderWidth: 1, borderColor: colores.linea, borderRadius: radio.sm }}>
                  <Text accessibilityRole="header">{diaSeleccionado ? `Actividades del ${diaSeleccionado}` : "Selecciona un día para consultar sus actividades"}</Text>
                  {diaSeleccionado && eventosDelDia(eventos, diaSeleccionado).length === 0 && <Text>Sin actividades publicadas para este día.</Text>}
                  {diaSeleccionado && eventosDelDia(eventos, diaSeleccionado).map((e) => <Text key={e.id} style={{ paddingVertical: espacio.sm }}>{e.titulo}</Text>)}
                </View>}
              </View>
            );
          })}
        </>
      ))}
    </View>
  );
}
