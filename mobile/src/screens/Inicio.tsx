import { crearControlLectura } from "../api/lectura-vigente";
import { fechaHoraEscolar } from "../utils/fecha-evento";
import {
  obtenerResumenInicio,
  type AvisoInicio,
  type EventoInicio,
} from "./inicio-resumen";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "../components/Texto";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { api, mensajeDeError } from "../api/client";
import { useSesion } from "../sesion";
import { colores, radio, espacio, tipografia, textoSobreFondo } from "../theme";
import { pesos } from "../formato";
import { base, Tarjeta } from "./comunes";

export default function InicioScreen() {
  const { sesion } = useSesion();
  const navigation = useNavigation();
  const [saldo, setSaldo] = useState<number | null>(null);
  const [avisos, setAvisos] = useState<AvisoInicio[] | null>(null);
  const [eventos, setEventos] = useState<EventoInicio[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [cargaInicialCompleta, setCargaInicialCompleta] = useState(false);
  const [error, setError] = useState("");

  const lectura = useRef(crearControlLectura());
  const cargar = useCallback(() => {
    setError("");
    setCargando(true);
    const hoy = new Date().toISOString();
    const en30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    void lectura.current.cargar(
      () => obtenerResumenInicio(hoy, en30),
      (datos) => {
        setSaldo(datos.saldo);
        setAvisos(datos.avisos);
        setEventos(datos.eventos);
        setError(
          datos.errores.length > 0
            ? `No se pudo actualizar: ${datos.errores.join(", ")}. Desliza para reintentar.`
            : "",
        );
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

  const leerAviso = async (aviso: AvisoInicio) => {
    if (aviso.leida) return;
    try {
      await api.patch(`/notificaciones/${aviso.id}/leer`);
      setAvisos(
        (previos) =>
          previos?.map((a) =>
            a.id === aviso.id ? { ...a, leida: true } : a,
          ) ?? null,
      );
      cargar();
    } catch (fallo) {
      setError(mensajeDeError(fallo));
    }
  };

  const nombre = sesion?.nombre.split(" ")[0] ?? "";

  return (
    <ScrollView
      style={base.pantalla}
      refreshControl={
        <RefreshControl refreshing={cargando} onRefresh={cargar} />
      }
    >
      <View style={estilos.encabezado}>
        <Text style={estilos.distintivo}>IUA · TU ESPACIO ESCOLAR</Text>
        <Text style={estilos.saludo} accessibilityRole="header">
          Hola, {nombre}
        </Text>
        <Text style={estilos.introduccion}>
          Consulta tu saldo, tus calificaciones y las novedades del plantel.
        </Text>
      </View>
      {error !== "" && (
        <View accessibilityRole="alert" style={estilos.error}>
          <Text style={estilos.errorTexto}>{error}</Text>
          <TouchableOpacity
            style={base.botonAccesible}
            onPress={cargar}
            accessibilityRole="button"
            accessibilityLabel="Reintentar cargar inicio"
          >
            <Text style={estilos.reintentar}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      )}

      {!cargaInicialCompleta && !error && (
        <ActivityIndicator accessibilityLabel="Cargando inicio" />
      )}
      {cargaInicialCompleta && (
        <View style={estilos.resumen}>
          <View style={estilos.kpi}>
            <Text
              style={[
                estilos.kpiValor,
                { color: textoSobreFondo(colores.pizarra) },
              ]}
            >
              {saldo === null ? "—" : pesos(saldo)}
            </Text>
            <Text
              style={[
                estilos.kpiEtiqueta,
                { color: textoSobreFondo(colores.pizarra) },
              ]}
            >
              Saldo pendiente
            </Text>
          </View>
        </View>
      )}

      {cargaInicialCompleta && (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Ver últimas calificaciones"
          style={estilos.botonCalificaciones}
          onPress={() => navigation.navigate('Calificaciones' as never)}
        >
          <Text style={estilos.botonCalificacionesTexto}>Ver últimas calificaciones →</Text>
        </TouchableOpacity>
      )}
      {cargaInicialCompleta && <Text style={estilos.subtitulo}>Avisos</Text>}
      {cargaInicialCompleta && avisos === null && (
        <Text style={base.secundario}>
          Avisos no disponibles. Intenta actualizar.
        </Text>
      )}
      {cargaInicialCompleta && avisos?.length === 0 && (
        <Text style={base.secundario}>Sin avisos por ahora.</Text>
      )}
      {cargaInicialCompleta &&
        avisos?.slice(0, 5).map((aviso) => (
          <TouchableOpacity
            key={aviso.id}
            onPress={() => leerAviso(aviso)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Aviso: ${aviso.titulo}. ${aviso.leida ? "Ya leído" : "Marcar como leído"}`}
            accessibilityState={{ disabled: aviso.leida }}
            disabled={aviso.leida}
          >
            <View style={[estilos.aviso, !aviso.leida && estilos.avisoSinLeer]}>
              <Text style={base.tituloTarjeta}>{aviso.titulo}</Text>
              <Text style={base.secundario}>{aviso.mensaje}</Text>
              <Text style={estilos.fecha}>
                {new Date(aviso.createdAt).toLocaleDateString("es-MX", {
                  day: "2-digit",
                  month: "short",
                })}
              </Text>
            </View>
          </TouchableOpacity>
        ))}

      {cargaInicialCompleta && (
        <Text style={estilos.subtitulo}>Próximos eventos</Text>
      )}
      {cargaInicialCompleta && eventos === null && (
        <Text style={base.secundario}>
          Calendario no disponible. Intenta actualizar.
        </Text>
      )}
      {cargaInicialCompleta && eventos?.length === 0 && (
        <Text style={[base.secundario, { marginBottom: 24 }]}>
          Sin eventos en los próximos 30 días.
        </Text>
      )}
      {cargaInicialCompleta &&
        eventos?.slice(0, 5).map((ev) => (
          <Tarjeta key={ev.id}>
            <Text style={base.tituloTarjeta}>{ev.titulo}</Text>
            <Text style={base.secundario}>
              {ev.tipo} ·{" "}
              {fechaHoraEscolar(ev.fechaInicio)}
            </Text>
          </Tarjeta>
        ))}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  encabezado: { backgroundColor: colores.pizarra, borderRadius: radio.md, padding: espacio.xl, marginBottom: espacio.xl, borderBottomWidth: 3, borderBottomColor: colores.dorado },
  distintivo: { color: colores.dorado, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginBottom: espacio.md },
  botonCalificaciones: { minHeight: 48, backgroundColor: colores.pizarra, borderRadius: radio.md, padding: espacio.md, justifyContent: "center", marginBottom: espacio.lg },
  botonCalificacionesTexto: { color: textoSobreFondo(colores.pizarra), fontWeight: "700", textAlign: "center" },
  error: {
    borderWidth: 1,
    borderColor: colores.peligro,
    padding: 12,
    marginBottom: 12,
    backgroundColor: "#fff",
  },
  errorTexto: { color: colores.peligro, marginBottom: 8 },
  reintentar: {
    color: colores.pizarra,
    textDecorationLine: "underline",
    fontWeight: "600",
  },
  saludo: {
    fontSize: tipografia.titulo,
    color: textoSobreFondo(colores.pizarra),
    marginBottom: 4,
    fontWeight: "700",
  },
  introduccion: {
    fontSize: tipografia.secundaria,
    color: textoSobreFondo(colores.pizarra),
    marginBottom: 0,
  },
  resumen: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: espacio.md,
    marginBottom: espacio.xl,
  },
  kpi: {
    flex: 1,
    minWidth: 140,
    backgroundColor: colores.pizarra,
    padding: espacio.lg,
    borderRadius: radio.md,
    borderLeftWidth: 3,
    borderLeftColor: colores.dorado,
  },
  kpiValor: {
    color: "#fff",
    fontSize: tipografia.dato,
    fontVariant: ["tabular-nums"],
    fontWeight: "600",
  },
  kpiEtiqueta: {
    color: "#C8D2CD",
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginTop: 2,
  },
  subtitulo: {
    fontSize: 12,
    color: colores.gris,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 8,
    marginTop: 6,
  },
  aviso: {
    backgroundColor: "#fff",
    borderRadius: radio.md,
    borderWidth: 1,
    borderColor: colores.linea,
    padding: espacio.lg,
    marginBottom: 10,
  },
  avisoSinLeer: {
    borderLeftWidth: 3,
    borderLeftColor: colores.dorado,
    backgroundColor: "#FDFBF5",
  },
  fecha: { fontSize: 11, color: colores.gris, marginTop: 4 },
});
