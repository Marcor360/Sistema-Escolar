import { useTemaAlumno, useEstilosAlumno, type ColoresAlumno } from "../tema-alumno";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, ScrollView, StyleSheet, View, TouchableOpacity } from "react-native";
import { useDisenoAlumno } from "../use-diseno-alumno";
import { IconoAlumno } from "./IconoAlumno";
import { Text } from "./Texto";
import { api, archivosBase, mensajeDeError } from "../api/client";
import { useBase } from "../screens/comunes";
import { diaCalendarioEscolar, mesInicialCalendario } from "../utils/calendario-escolar";

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
  const base = useBase();
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
export function CalendarioCiclo({ abiertoInicial = false }: { abiertoInicial?: boolean } = {}) {
  const estilos = useEstilosAlumno(crearEstilos);
  const [abierto, setAbierto] = useState(abiertoInicial);
  return (
    <View>
      {!abiertoInicial && <TouchableOpacity
        style={estilos.opcion}
        accessibilityRole="button"
        accessibilityState={{ expanded: abierto }}
        onPress={() => setAbierto((v) => !v)}
      >
        <Text>
          {abierto
            ? "Ocultar calendario institucional"
            : "Ver calendario institucional"}
        </Text>
      </TouchableOpacity>}
      {abierto && <ContenidoCalendario />}
    </View>
  );
}
function ContenidoCalendario() {
  const estilos = useEstilosAlumno(crearEstilos);
  const { colores } = useTemaAlumno();
  const { amplio, anchoContenido } = useDisenoAlumno();
  const compacto = anchoContenido <= 420;
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
          setSeleccion(anterior => data.ciclos.some(c => c.id === anterior)
            ? anterior : data.ciclos.find(c => c.activo)?.id ?? data.ciclos[0]?.id ?? 0);
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
    setMes(anterior => anterior >= ciclo.fechaInicio.slice(0, 7) && anterior <= ciclo.fechaFin.slice(0, 7)
      ? anterior : mesInicialCalendario(ciclo.fechaInicio, ciclo.fechaFin, hoyEscolar));
    setDiaSeleccionado(anterior => anterior >= ciclo.fechaInicio && anterior <= ciclo.fechaFin
      ? anterior : hoyEscolar >= ciclo.fechaInicio && hoyEscolar <= ciclo.fechaFin ? hoyEscolar : ciclo.fechaInicio);
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
  const indiceMes = meses.indexOf(mes);
  const hoyEscolar = dia(new Date().toISOString());
  const eventosFechados = useMemo(() => eventos.filter(e => !e.imagenNombre)
    .sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio))
    .map(evento => ({ evento, inicio: dia(evento.fechaInicio), fin: dia(evento.fechaFin ?? evento.fechaInicio) })), [eventos]);
  const actividadesDelDia = (fecha: string) => eventosFechados.filter(e => e.inicio <= fecha && fecha <= e.fin);
  const eventosSeleccionados = diaSeleccionado ? actividadesDelDia(diaSeleccionado) : [];
  const imagenes = eventos.filter(e => e.imagenNombre);
  const opcionesVista = { mes: "Mes", ciclo: "Ciclo completo", imagen: "Imagen institucional", agenda: "Agenda accesible" } as const;
  const textoFecha = (fecha: string, opciones: Intl.DateTimeFormatOptions) => {
    const texto = new Intl.DateTimeFormat("es-MX", { ...opciones, timeZone: "UTC" }).format(new Date(fecha + "T12:00:00Z"));
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  };
  const nombreMes = (mesVisible: string) => textoFecha(mesVisible + "-01", { month: "long", year: "numeric" });
  const cambiarMes = (indice: number) => {
    const destino = meses[indice];
    if (!destino) return;
    setMes(destino);
    setDiaSeleccionado(destino === hoyEscolar.slice(0, 7) ? hoyEscolar :
      destino === ciclo?.fechaInicio.slice(0, 7) ? ciclo.fechaInicio : destino + "-01");
  };
  const opcion = (titulo: string, seleccionada: boolean, seleccionar: () => void, etiqueta = titulo) => (
    <TouchableOpacity key={etiqueta} accessibilityRole="button" accessibilityLabel={etiqueta}
      accessibilityState={{ selected: seleccionada }} {...{ "aria-pressed": seleccionada }} onPress={seleccionar}
      style={[estilos.opcion, seleccionada && estilos.opcionActiva]}>
      <Text style={seleccionada ? estilos.textoActivo : estilos.textoOpcion}>{titulo}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[estilos.panel, compacto && estilos.panelCompacto]}>
      <Text accessibilityRole="header" style={[estilos.titulo, compacto && estilos.margenCompacto]}>Calendario del ciclo escolar</Text>
      {ciclos.length === 1 && <Text style={[estilos.secundario, compacto && estilos.margenCompacto]}>{ciclos[0].nombre}</Text>}
      {ciclos.length > 1 && <View style={[estilos.opciones, compacto && estilos.margenCompacto]}>
        {ciclos.map(c => opcion(c.nombre, c.id === seleccion, () => setSeleccion(c.id)))}
      </View>}
      {!!ciclo && <>
        <View style={[estilos.opciones, compacto && estilos.margenCompacto]} accessibilityLabel="Alcance del calendario">
          {opcion("Mi plantel e institucional", ambito === "CONSOLIDADO", () => setAmbito("CONSOLIDADO"), "Eventos institucionales y de mi plantel")}
          {opcion("Solo institucional", ambito === "GLOBAL", () => setAmbito("GLOBAL"), "Solo eventos institucionales")}
        </View>
        <View style={[estilos.vistas, compacto && estilos.margenCompacto]} accessibilityLabel="Vistas del calendario">
          {(Object.keys(opcionesVista) as Array<keyof typeof opcionesVista>).map(v =>
            opcion(opcionesVista[v], vista === v, () => setVista(v)),
          )}
        </View>
      </>}
      {cargando && <View style={estilos.carga}><ActivityIndicator color={colores.enlace} /><Text>Consultando calendario…</Text></View>}
      {!!error && <View accessibilityRole="alert" style={estilos.detalleDia}>
        <Text style={{ color: colores.peligro }}>{error}</Text>
        <TouchableOpacity accessibilityRole="button" style={estilos.opcion} onPress={() => setRevision(r => r + 1)}><Text>Reintentar</Text></TouchableOpacity>
      </View>}
      {!cargando && !error && !ciclo && <Text style={estilos.secundario}>No hay ciclos escolares disponibles.</Text>}
      {!cargando && !error && ciclo && vista === "imagen" && (
        imagenes.length ? imagenes.map(evento => <ImagenCiclo key={evento.id} evento={evento} />) : <Text style={estilos.secundario}>No hay imagen publicada para tu nivel.</Text>
      )}
      {!cargando && !error && ciclo && vista === "agenda" && <View style={estilos.detalleDia}>
        {eventosFechados.length ? eventosFechados.map(({ evento: e }) => (
          <View key={e.id} style={estilos.evento}>
            <Text style={estilos.secundario}>{dia(e.fechaInicio)}{e.fechaFin ? " — " + dia(e.fechaFin) : ""}</Text>
            <Text style={estilos.textoOpcion}>{e.titulo}</Text>
          </View>
        )) : <Text style={estilos.secundario}>No hay eventos en la agenda de este ciclo.</Text>}
      </View>}
      {!cargando && !error && ciclo && (vista === "mes" || vista === "ciclo") && (
        <View style={[estilos.distribucion, amplio && vista === "mes" && { flexDirection: "row", alignItems: "flex-start" }]}>
          <View style={{ flex: amplio && vista === "mes" ? 1 : undefined, minWidth: 0, gap: 18 }}>
            {(vista === "mes" ? [mes] : meses).filter(Boolean).map(m => {
              const [a, n] = m.split("-").map(Number);
              const dias = new Date(Date.UTC(a, n, 0)).getUTCDate();
              const offset = (new Date(Date.UTC(a, n - 1, 1)).getUTCDay() + 6) % 7;
              const semanas = Math.ceil((offset + dias) / 7);
              return <View key={m} style={estilos.mes}>
                <View style={estilos.encabezadoMes}>
                  {vista === "mes" && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Mes anterior"
                    disabled={indiceMes <= 0} accessibilityState={{ disabled: indiceMes <= 0 }}
                    onPress={() => cambiarMes(indiceMes - 1)} style={[estilos.flecha, indiceMes <= 0 && estilos.deshabilitado]}>
                    <IconoAlumno nombre="chevron" color={colores.enlace} tamano={20} invertido />
                  </TouchableOpacity>}
                  <Text accessibilityRole="header" style={estilos.nombreMes}>{nombreMes(m)}</Text>
                  {vista === "mes" && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Mes siguiente"
                    disabled={indiceMes >= meses.length - 1} accessibilityState={{ disabled: indiceMes >= meses.length - 1 }}
                    onPress={() => cambiarMes(indiceMes + 1)} style={[estilos.flecha, indiceMes >= meses.length - 1 && estilos.deshabilitado]}>
                    <IconoAlumno nombre="chevron" color={colores.enlace} tamano={20} />
                  </TouchableOpacity>}
                </View>
                <ScrollView horizontal nestedScrollEnabled contentContainerStyle={{ minWidth: 308, flexGrow: 1 }}>
                  <View style={{ flex: 1 }}>
                    <View style={estilos.semana}>
                      {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map(d => <Text key={d} style={estilos.diaSemana}>{d}</Text>)}
                    </View>
                    {Array.from({ length: semanas }, (_, semana) => <View key={semana} style={estilos.semana}>
                      {Array.from({ length: 7 }, (_, columna) => {
                        const numero = semana * 7 + columna - offset + 1;
                        if (numero < 1 || numero > dias) return <View key={columna} style={estilos.celdaVacia} />;
                        const fecha = m + "-" + String(numero).padStart(2, "0");
                        const cantidad = actividadesDelDia(fecha).length;
                        const seleccionado = diaSeleccionado === fecha;
                        const hoy = fecha === hoyEscolar;
                        return (
                          <TouchableOpacity key={columna} accessibilityRole="button"
                            accessibilityLabel={`${fecha}: ${cantidad} evento(s)`}
                            accessibilityHint={hoy ? "Hoy" : undefined}
                            accessibilityState={{ selected: seleccionado }}
                            {...{ "aria-pressed": seleccionado }}
                            onPress={() => { setDiaSeleccionado(fecha); setMes(m); setVista("mes"); }}
                            style={[estilos.celda, amplio && { minHeight: 70 }, hoy && estilos.hoy, seleccionado && estilos.celdaActiva]}>
                            <Text style={[estilos.numero, seleccionado && { color: colores.sobrePrimario }]}>{numero}</Text>
                            {cantidad > 0 && <View style={[estilos.contador, seleccionado && { backgroundColor: colores.sobrePrimario }]}>
                              <Text style={{ color: seleccionado ? colores.pizarra : colores.enlace, fontSize: 12, fontWeight: "700" }}>{cantidad}</Text>
                            </View>}
                          </TouchableOpacity>
                        );
                      })}
                    </View>)}
                  </View>
                </ScrollView>
              </View>;
            })}
          </View>
          {vista === "mes" && <View style={[estilos.detalleDia, amplio && { width: "28%" }]}>
            <Text accessibilityRole="header" accessibilityLabel={diaSeleccionado ? `Actividades del ${diaSeleccionado}` : undefined} style={estilos.titulo}>
              {diaSeleccionado ? textoFecha(diaSeleccionado, { weekday: "long", day: "numeric", month: "long" }) : "Actividades del día"}
            </Text>
            {eventosSeleccionados.length ? eventosSeleccionados.map(({ evento: e }) => <View key={e.id} style={estilos.evento}><Text style={estilos.textoOpcion}>{e.titulo}</Text></View>)
              : <Text style={estilos.secundario}>Sin actividades publicadas para este día.</Text>}
          </View>}
        </View>
      )}
    </View>
  );
}

const crearEstilos = (colores: ColoresAlumno) => StyleSheet.create({
  panel: { backgroundColor: colores.superficie, borderWidth: 1, borderColor: colores.linea, borderRadius: 16, padding: 14, gap: 12, marginBottom: 16, minWidth: 0 },
  panelCompacto: { paddingHorizontal: 4 },
  margenCompacto: { marginHorizontal: 8 },
  titulo: { fontSize: 19, fontWeight: "700", color: colores.tinta },
  secundario: { color: colores.gris, lineHeight: 22 },
  opciones: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  vistas: { flexDirection: "row", flexWrap: "wrap", gap: 8, borderTopWidth: 1, borderColor: colores.linea, paddingTop: 12 },
  opcion: { alignSelf: "flex-start", minHeight: 44, paddingHorizontal: 12, paddingVertical: 8, justifyContent: "center", borderRadius: 9, borderWidth: 1, borderColor: colores.linea, backgroundColor: colores.superficie, marginBottom: 2 },
  opcionActiva: { backgroundColor: colores.pizarra, borderColor: colores.pizarra },
  textoOpcion: { fontSize: 14, color: colores.tinta, fontWeight: "600" },
  textoActivo: { fontSize: 14, color: colores.sobrePrimario, fontWeight: "700" },
  carga: { flexDirection: "row", gap: 10, alignItems: "center", paddingVertical: 16 },
  distribucion: { gap: 14, minWidth: 0 },
  mes: { borderWidth: 1, borderColor: colores.linea, backgroundColor: colores.papel, borderRadius: 12, overflow: "hidden" },
  encabezadoMes: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, padding: 8 },
  nombreMes: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700" },
  flecha: { alignItems: "center", justifyContent: "center", width: 44, height: 44, borderRadius: 8, borderWidth: 1, borderColor: colores.linea, backgroundColor: colores.superficie },
  deshabilitado: { opacity: 0.4 },
  semana: { flexDirection: "row" },
  diaSemana: { flex: 1, minWidth: 44, textAlign: "center", paddingVertical: 10, fontSize: 12, color: colores.gris, fontWeight: "700" },
  celda: { flex: 1, minWidth: 44, minHeight: 56, alignItems: "center", justifyContent: "center", gap: 3, borderWidth: 0.5, borderColor: colores.linea, backgroundColor: colores.superficie },
  celdaVacia: { flex: 1, minWidth: 44, backgroundColor: colores.suave, borderWidth: 0.5, borderColor: colores.linea },
  celdaActiva: { backgroundColor: colores.pizarra, borderColor: colores.pizarra },
  hoy: { borderWidth: 2, borderColor: colores.enlace },
  numero: { fontSize: 15, fontWeight: "600" },
  contador: { borderRadius: 12, paddingHorizontal: 6, backgroundColor: colores.suave },
  detalleDia: { padding: 14, gap: 8, borderRadius: 12, borderWidth: 1, borderColor: colores.linea, backgroundColor: colores.papel },
  evento: { borderLeftWidth: 3, borderLeftColor: colores.dorado, padding: 10, backgroundColor: colores.superficie, borderRadius: 6 },
});
