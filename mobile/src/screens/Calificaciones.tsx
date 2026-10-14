import { crearControlLectura } from "../api/lectura-vigente";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  View,
} from "react-native";
import { Text } from "../components/Texto";
import { useFocusEffect } from "@react-navigation/native";
import { api, mensajeDeError } from "../api/client";
import { useSesion } from "../sesion";
import { ordenarPeriodos } from "../utils/orden-calificaciones";
import { GuiaPantalla, base, ErrorCarga, Tarjeta, Vacio } from "./comunes";

interface Calificacion {
  id: number;
  parcial: number;
  calificacion: number;
  promedioOficial: number | null;
  grupoMateriaId: number;
  grupoMateria: {
    grupo: { nombre: string; ciclo: { id: number; nombre: string } };
    materia: { clave: string; nombre: string };
  };
}

export default function CalificacionesScreen() {
  const { sesion } = useSesion();
  const [registros, setRegistros] = useState<Calificacion[]>([]);
  const [cargando, setCargando] = useState(false);
  const [cargaInicialCompleta, setCargaInicialCompleta] = useState(false);
  const [error, setError] = useState("");
  const [ultimaActualizacion, setUltimaActualizacion] = useState<string | null>(
    null,
  );

  const lectura = useRef(crearControlLectura());
  useEffect(() => {
    lectura.current.invalidar();
    setRegistros([]);
    setError("");
    setCargando(false);
    setCargaInicialCompleta(false);
    setUltimaActualizacion(null);
  }, [sesion?.sub]);
  const cargar = useCallback(() => {
    if (!sesion?.sub) return;
    setError("");
    setCargando(true);
    void lectura.current.cargar(
      () => api.get<Calificacion[]>("/calificaciones/mias"),
      (r) => {
        setRegistros(r.data);
        setUltimaActualizacion(new Date().toLocaleString());
        setCargaInicialCompleta(true);
      },
      (fallo) => setError(mensajeDeError(fallo)),
      () => setCargando(false),
    );
  }, [sesion?.sub]);

  useFocusEffect(
    useCallback(() => {
      cargar();
      return () => lectura.current.invalidar();
    }, [cargar]),
  );

  // Agrupar por materia para lectura tipo boleta
  const materias = new Map<
    string,
    { nombre: string; parciales: Calificacion[] }
  >();
  for (const r of registros) {
    const clave = String(r.grupoMateriaId);
    const grupo = materias.get(clave) ?? {
      nombre: `${r.grupoMateria.materia.clave} — ${r.grupoMateria.materia.nombre} · ${r.grupoMateria.grupo.nombre} · ${r.grupoMateria.grupo.ciclo.nombre}`,
      parciales: [],
    };
    grupo.parciales.push(r);
    materias.set(clave, grupo);
  }
  const filas = [...materias.entries()];

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
            titulo="Mis calificaciones"
            detalle="El promedio oficial usa los parciales 1, 2 y 3. La evaluación Final se muestra por separado; un parcial pendiente no equivale a cero."
          />
        }
        data={filas}
        keyExtractor={([clave]) => clave}
        refreshControl={
          <RefreshControl refreshing={cargando} onRefresh={cargar} />
        }
        ListEmptyComponent={
          cargaInicialCompleta && !error ? (
            <Vacio mensaje="Aún no hay calificaciones capturadas." />
          ) : !cargaInicialCompleta && !error ? (
            <ActivityIndicator accessibilityLabel="Cargando calificaciones" />
          ) : null
        }
        renderItem={({ item: [, materia] }) => {
          const promedio = materia.parciales[0]?.promedioOficial;
          return (
            <Tarjeta>
              <Text style={base.tituloTarjeta} accessibilityRole="header">
                {materia.nombre}
              </Text>
              {ordenarPeriodos(materia.parciales).map((p) => (
                  <Text key={p.id} style={base.secundario}>
                    {p.parcial === 0 ? "Final" : `Parcial ${p.parcial}`}:{" "}
                    <Text style={base.monto}>{p.calificacion.toFixed(1)}</Text>
                  </Text>
                ))}
              <Text style={[base.secundario, { marginTop: 4 }]}>
                Promedio oficial (P1–P3):{" "}
                <Text style={base.monto}>
                  {promedio == null
                    ? "Pendiente de P1-P3"
                    : promedio.toFixed(1)}
                </Text>
              </Text>
            </Tarjeta>
          );
        }}
      />
    </View>
  );
}
