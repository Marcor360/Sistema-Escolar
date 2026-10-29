import { RespuestaBoleta } from "../components/RespuestaBoleta";
import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  ActivityIndicator,
  Linking,
  Platform,
  TouchableOpacity,
  View,
} from "react-native";
import { colores, textoSobreFondo } from "../theme";
import { useMarca } from "../marca";
import { Text } from "../components/Texto";
import { api, archivosBase, mensajeDeError } from "../api/client";
import { resolverEnlacePrivado } from "../api/enlaces-privados";
import { base } from "./comunes";
interface Boleta {
  institucion: string;
  alumno: string;
  matricula: string;
  plan: string;
  plantel: string;
  periodo: string;
  ciclo: string;
  escala: string;
  disponible: boolean;
  aviso: string;
  promedioGeneral: number | null;
  filas: {
    clave: string;
    asignatura: string;
    creditos: number;
    seriacion: string;
    ciclo: string;
    promedioFinal: number | null;
    observaciones: string;
  }[];
}
export function BoletaInformativa({
  inscripcionId,
}: {
  inscripcionId: number;
}) {
  const { marca } = useMarca();
  const vigente = useRef(0);
  const [datos, setDatos] = useState<Boleta | null>(null),
    [error, setError] = useState(""),
    [ocupado, setOcupado] = useState(false),
    [intento, setIntento] = useState(0);
  useFocusEffect(
    useCallback(() => {
      const turno = ++vigente.current;
      let activo = true;
      const controller = new AbortController();
      setDatos(null);
      setError("");
      void api
        .get<Boleta>("/reportes/formatos/mi-boleta", {
          params: { inscripcionId },
          signal: controller.signal,
        })
        .then((r) => {
          if (activo) setDatos(r.data);
        })
        .catch((e) => {
          if (activo) setError(mensajeDeError(e));
        });
      return () => {
        activo = false;
        vigente.current = turno + 1;
        controller.abort();
      };
    }, [inscripcionId, intento]),
  );
  const descargar = async (
    formato: "informativa-pdf" | "informativa-excel",
  ) => {
    if (ocupado || !datos?.disponible) return;
    const turno = vigente.current;
    setOcupado(true);
    setError("");
    try {
      const { data } = await api.get<{ url: string }>(
        "/reportes/mi-boleta/enlace",
        { params: { inscripcionId, formato } },
      );
      if (turno !== vigente.current) return;
      const enlace = resolverEnlacePrivado(archivosBase, data.url, "boleta");
      if (Platform.OS === "web") {
        const respuesta = await fetch(enlace, {
          credentials: "omit",
          referrerPolicy: "no-referrer",
        });
        if (!respuesta.ok)
          throw new Error(
            "No se pudo descargar la boleta. Actualiza e inténtalo nuevamente.",
          );
        if (turno !== vigente.current) return;
        const archivo = await respuesta.blob();
        if (turno !== vigente.current) return;
        const url = URL.createObjectURL(archivo),
          a = document.createElement("a");
        a.href = url;
        a.download = `boleta-${inscripcionId}.${formato === "informativa-excel" ? "xlsx" : "pdf"}`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } else await Linking.openURL(enlace);
    } catch (e) {
      if (turno === vigente.current) setError(mensajeDeError(e));
    } finally {
      if (turno === vigente.current) setOcupado(false);
    }
  };
  return (
    <View style={base.tarjeta}>
      <Text accessibilityRole="header" style={base.tituloTarjeta}>
        Boleta informativa
      </Text>
      {error ? (
        <>
          <Text accessibilityRole="alert">{error}</Text>
          <TouchableOpacity
            accessibilityRole="button"
            style={{ minHeight: 44, justifyContent: "center" }}
            onPress={() => setIntento((i) => i + 1)}
          >
            <Text>Actualizar boleta</Text>
          </TouchableOpacity>
        </>
      ) : null}
      {!datos && !error ? (
        <ActivityIndicator accessibilityLabel="Cargando boleta informativa" />
      ) : null}
      {datos && !datos.disponible ? (
        <Text>
          Tu boleta estará disponible cuando Control Escolar cierre las
          evaluaciones requeridas de todas tus materias.
        </Text>
      ) : null}
      {datos?.disponible ? (
        <>
          <Text>
            {datos.institucion} · {datos.plantel}
          </Text>
          <Text>
            {datos.alumno} · {datos.matricula}
          </Text>
          <Text>
            Plan: {datos.plan || "Sin registro"} · Periodo:{" "}
            {datos.periodo || "Sin registro"} · Ciclo: {datos.ciclo}
          </Text>
          <Text>Escala: {datos.escala}</Text>
          <View
            style={{
              backgroundColor: colores.papel,
              borderWidth: 1,
              borderColor: colores.linea,
              borderRadius: 16,
              padding: 18,
              marginVertical: 14,
              gap: 4,
            }}
          >
            <Text style={{ color: colores.gris }}>
              Promedio general del periodo
            </Text>
            <Text
              accessibilityLabel={`Promedio general ${datos.promedioGeneral ?? "pendiente"}`}
              style={{ fontSize: 32, fontWeight: "700", color: colores.tinta }}
            >
              {datos.promedioGeneral ?? "Pendiente"}
            </Text>
            <Text style={{ color: colores.gris }}>
              {datos.filas.length} asignaturas · {datos.escala}
            </Text>
          </View>
          <Text
            accessibilityRole="header"
            style={{
              fontWeight: "700",
              fontSize: 18,
              color: colores.tinta,
              marginBottom: 8,
            }}
          >
            Resultados por materia
          </Text>
          {datos.filas.map((f, i) => (
            <View
              key={`${f.clave}-${i}`}
              style={{
                borderWidth: 1,
                borderColor: colores.linea,
                borderRadius: 12,
                padding: 14,
                marginBottom: 10,
                backgroundColor: "#FFFFFF",
                gap: 5,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <Text style={{ color: colores.gris, flex: 1 }}>
                  {f.clave} · {f.ciclo}
                </Text>
                <Text
                  accessibilityLabel={`Calificación final ${f.promedioFinal ?? "pendiente"}`}
                  style={{
                    color: colores.tinta,
                    fontWeight: "700",
                    fontSize: 20,
                  }}
                >
                  {f.promedioFinal ?? "—"}
                </Text>
              </View>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "700",
                  color: colores.tinta,
                }}
              >
                {f.asignatura}
              </Text>
              <Text style={{ color: colores.gris }}>
                Créditos: {f.creditos.toFixed(2)}
                {f.seriacion ? ` · Seriación: ${f.seriacion}` : ""}
              </Text>
              {f.observaciones ? (
                <Text style={{ color: colores.gris }}>
                  Observaciones: {f.observaciones}
                </Text>
              ) : null}
            </View>
          ))}
          <Text style={{ color: colores.gris, marginBottom: 10 }}>
            {datos.aviso}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Descargar boleta informativa PDF"
            accessibilityState={{ disabled: ocupado, busy: ocupado }}
            disabled={ocupado}
            style={{
              minHeight: 48,
              justifyContent: "center",
              borderRadius: 12,
              padding: 12,
              backgroundColor: marca.colorPrimario,
              marginBottom: 8,
            }}
            onPress={() => void descargar("informativa-pdf")}
          >
            <Text
              style={{
                color: textoSobreFondo(marca.colorPrimario),
                textAlign: "center",
                fontWeight: "700",
              }}
            >
              {ocupado ? "Preparando archivo…" : "Descargar boleta PDF"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Descargar mi boleta Excel"
            accessibilityState={{ disabled: ocupado, busy: ocupado }}
            disabled={ocupado}
            style={{ minHeight: 48, justifyContent: "center", padding: 12 }}
            onPress={() => void descargar("informativa-excel")}
          >
            <Text style={{ textAlign: "center", color: colores.tinta }}>
              Descargar también en Excel
            </Text>
          </TouchableOpacity>
          <Text style={{ color: colores.gris, fontSize: 12 }}>
            El archivo se guarda o abre con el navegador del dispositivo.
            Necesitas conexión para solicitarlo.
          </Text>
        </>
      ) : null}
      {datos?.disponible && <RespuestaBoleta inscripcionId={inscripcionId} />}
    </View>
  );
}
