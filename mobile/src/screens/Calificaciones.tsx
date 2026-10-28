import { useDisenoAlumno } from "../use-diseno-alumno";
import { BoletaInformativa } from "./BoletaInformativa";
import { Paginador } from "../components/Paginador";
import { ordenarPeriodos } from "../utils/orden-calificaciones";
import { useSesion } from "../sesion";
import { leerConCache } from "../api/cache-academica";
import { resolverEnlacePrivado } from "../api/enlaces-privados";
import { crearControlLectura } from "../api/lectura-vigente";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  View,
} from "react-native";
import { Text } from "../components/Texto";
import { useFocusEffect } from "@react-navigation/native";
import { api, archivosBase, mensajeDeError } from "../api/client";
import { GuiaPantalla, base, ErrorCarga, Tarjeta, Vacio } from "./comunes";

interface Boleta {
  inscripcionId: number;
  cicloId: number;
  ciclo: string;
  grupo: string;
  plantel: string;
}
interface Calificacion {
  id: number;
  parcial: number;
  calificacion: number;
  promedioOficial: number | null;
  escalaMaxima?: number;
  regimenEvaluacion?: string;
  grupoMateriaId: number;
  grupoMateria: {
    grupo: { nombre: string; ciclo: { id: number; nombre: string } };
    materia: { clave: string; nombre: string };
  };
}

export default function CalificacionesScreen() {
  const diseno = useDisenoAlumno();
  const { sesion } = useSesion();
  const [pagina, setPagina] = useState(1),
    [total, setTotal] = useState(0);
  useEffect(() => {
    setPagina(1);
    setTotal(0);
  }, [sesion?.sub]);

  const [boletas, setBoletas] = useState<Boleta[]>([]);
  const [inscripcionBoleta, setInscripcionBoleta] = useState<number | null>(
    null,
  );
  const [errorBoletas, setErrorBoletas] = useState("");
  const lecturaBoletas = useRef(crearControlLectura());
  const cargarBoletas = useCallback(() => {
    if (!sesion?.sub) return;
    setErrorBoletas("");
    void lecturaBoletas.current.cargar(
      () => api.get<Boleta[]>("/reportes/mis-boletas"),
      (r) => setBoletas(r.data),
      (e) => setErrorBoletas(mensajeDeError(e)),
      () => undefined,
    );
  }, [sesion?.sub]);
  const [registros, setRegistros] = useState<Calificacion[]>([]);
  const [cargando, setCargando] = useState(false);
  const [cargaInicialCompleta, setCargaInicialCompleta] = useState(false);
  const [error, setError] = useState("");
  const [ultimaActualizacion, setUltimaActualizacion] = useState<string | null>(
    null,
  );

  const [offline, setOffline] = useState(false);
  const [cacheExpira, setCacheExpira] = useState(0);
  useEffect(() => {
    if (!offline || !cacheExpira) return;
    const timer = setTimeout(
      () => {
        setRegistros([]);
        setOffline(false);
        setUltimaActualizacion(null);
        setError("La copia de lectura venció. Conéctate y actualiza.");
      },
      Math.max(0, cacheExpira - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [offline, cacheExpira]);
  const descargaVigente = useRef(0);
  const [descargando, setDescargando] = useState(false);
  const descargar = async (cicloId?: number, inscripcionId?: number) => {
    if (descargando) return;
    const actual = ++descargaVigente.current;
    setDescargando(true);
    setError("");
    try {
      const { data } = await api.get<{ url: string }>(
        "/reportes/mi-boleta/enlace",
        { params: { cicloId, inscripcionId, formato: "informativa-pdf" } },
      );
      if (actual === descargaVigente.current)
        await Linking.openURL(
          resolverEnlacePrivado(archivosBase, data.url, "boleta"),
        );
    } catch (e) {
      if (actual === descargaVigente.current) setError(mensajeDeError(e));
    } finally {
      if (actual === descargaVigente.current) setDescargando(false);
    }
  };

  const lectura = useRef(crearControlLectura());
  useEffect(() => {
    lectura.current.invalidar();
    descargaVigente.current++;
    setRegistros([]);
    setBoletas([]);
    setInscripcionBoleta(null);
    setErrorBoletas("");
    lecturaBoletas.current.invalidar();
    setError("");
    setOffline(false);
    setCacheExpira(0);
    setCargando(false);
    setDescargando(false);
    setUltimaActualizacion(null);
    setCargaInicialCompleta(false);
  }, [sesion?.sub]);
  const cargar = useCallback(() => {
    if (!sesion?.sub) return;
    setError("");
    setRegistros([]);
    setCargando(true);
    void lectura.current.cargar(
      () =>
        leerConCache("/calificaciones/mias/listado?pagina=" + pagina, () =>
          api.get<{ datos: Calificacion[]; total: number }>(
            "/calificaciones/mias/listado",
            { params: { pagina, porPagina: 10 } },
          ),
        ),
      (r) => {
        setRegistros(r.data.datos);
        setTotal(r.data.total);
        setOffline(r.offline);
        setCacheExpira(r.fecha + 5 * 60000);
        setUltimaActualizacion(new Date(r.fecha).toLocaleString());
        setCargaInicialCompleta(true);
      },
      (fallo) => setError(mensajeDeError(fallo)),
      () => setCargando(false),
    );
  }, [sesion?.sub, pagina]);

  useFocusEffect(
    useCallback(() => {
      cargar();
      return () => {
        lectura.current.invalidar();
        descargaVigente.current++;
        setDescargando(false);
      };
    }, [cargar]),
  );

  useFocusEffect(
    useCallback(() => {
      cargarBoletas();
      return () => {
        lecturaBoletas.current.invalidar();
      };
    }, [cargarBoletas]),
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
    <View style={[base.pantalla, diseno.pantalla]}>
      <FlatList
        contentContainerStyle={base.contenidoLista}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <>
            <GuiaPantalla
              titulo="Mis calificaciones"
              detalle="Consulta la escala de cada materia. En el esquema 0–10, P1–P4 aportan 25 % cada uno y la propuesta requiere aprobación o captura manual de Final. Un parcial pendiente no equivale a cero."
            />

            {error !== "" && <ErrorCarga mensaje={error} reintentar={cargar} />}
            {ultimaActualizacion && (
              <Text accessibilityRole="text">
                Última actualización: {ultimaActualizacion}
              </Text>
            )}
            {offline && (
              <Text accessibilityRole="alert">
                Sin conexión: copia de lectura de esta sesión, hasta 5 minutos.
                No confirma cambios.
              </Text>
            )}
            {errorBoletas && !offline && (
              <ErrorCarga mensaje={errorBoletas} reintentar={cargarBoletas} />
            )}
            {!boletas.length && (
              <TouchableOpacity
                accessibilityRole="button"
                disabled={descargando || offline}
                onPress={() => descargar()}
                style={base.tarjeta}
              >
                <Text>Descargar boleta del ciclo vigente</Text>
              </TouchableOpacity>
            )}
            <Paginador
              pagina={pagina}
              total={total}
              ocupado={cargando}
              cambiar={setPagina}
            />
            {inscripcionBoleta !== null && (
              <BoletaInformativa
                key={`${sesion?.sub}-${inscripcionBoleta}`}
                inscripcionId={inscripcionBoleta}
              />
            )}
            {boletas.map((b) => (
              <TouchableOpacity
                key={b.inscripcionId}
                accessibilityRole="button"
                accessibilityLabel={`Ver boleta de ${b.ciclo}, ${b.grupo}`}
                disabled={descargando || offline}
                onPress={() => setInscripcionBoleta(b.inscripcionId)}
                style={base.tarjeta}
              >
                <Text>
                  {descargando
                    ? "Abriendo boleta…"
                    : `Ver boleta · ${b.ciclo} · ${b.grupo} · ${b.plantel}`}
                </Text>
              </TouchableOpacity>
            ))}
          </>
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
                  <Text style={base.monto}>{String(p.calificacion)}</Text>
                </Text>
              ))}
              <Text style={[base.secundario, { marginTop: 4 }]}>
                Resultado oficial · escala 0–{materia.parciales[0]?.escalaMaxima ?? 100}:{" "}
                <Text style={base.monto}>
                  {promedio == null
                    ? "Pendiente de evaluación"
                    : String(promedio)}
                </Text>
              </Text>
            </Tarjeta>
          );
        }}
      />
    </View>
  );
}
