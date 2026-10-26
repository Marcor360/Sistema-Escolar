import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Text } from "../components/Texto";
import { api, archivosBase, mensajeDeError } from "../api/client";
import { leerConCache } from "../api/cache-academica";
import { resolverEnlacePrivado } from "../api/enlaces-privados";
import { crearControlLectura } from "../api/lectura-vigente";
import { useSesion } from "../sesion";
import { colores, espacio, radio } from "../theme";
import { base, ErrorCarga, GuiaPantalla, Tarjeta, Vacio } from "./comunes";

interface Boleta {
  inscripcionId: number;
  cicloId: number;
  ciclo: string;
  grupo: string;
  plantel: string;
}
interface Materia {
  id: number;
  materia: { clave: string; nombre: string };
  grupo: { nombre: string; ciclo: { clave: string } };
}
interface Material {
  id: number;
  titulo: string;
  archivoNombre: string;
  tamanoKb: number;
}
type Lectura<T> = { data: T; offline: boolean; fecha: number };
const VIDA_CACHE = 5 * 60 * 1000;

/** Carpetas de consulta del alumno: índices de la API, no archivos locales ni biblioteca administrativa. */
export default function DocumentosScreen() {
  const { sesion } = useSesion();
  const [boletas, setBoletas] = useState<Boleta[]>([]);
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [materiales, setMateriales] = useState<Record<number, Material[]>>({});
  const [carpetaAbierta, setCarpetaAbierta] = useState<number | null>(null);
  const [cargando, setCargando] = useState(false);
  const [cargandoCarpeta, setCargandoCarpeta] = useState<number | null>(null);
  const [abriendo, setAbriendo] = useState(false);
  const [inicialCompleta, setInicialCompleta] = useState(false);
  const [sinConexion, setSinConexion] = useState(false);
  const [expiraCache, setExpiraCache] = useState(0);
  const [error, setError] = useState("");
  const [errorCarpeta, setErrorCarpeta] = useState("");
  const lectura = useRef(crearControlLectura());
  const solicitudCarpeta = useRef(0);
  const solicitudArchivo = useRef(0);
  const aperturaEnCurso = useRef(false);

  useEffect(() => {
    lectura.current.invalidar();
    solicitudCarpeta.current++;
    solicitudArchivo.current++;
    aperturaEnCurso.current = false;
    setBoletas([]);
    setMaterias([]);
    setMateriales({});
    setCarpetaAbierta(null);
    setInicialCompleta(false);
    setSinConexion(false);
    setExpiraCache(0);
    setError("");
    setErrorCarpeta("");
    setCargando(false);
    setCargandoCarpeta(null);
    setAbriendo(false);
  }, [sesion?.sub]);

  useEffect(() => {
    if (!sinConexion || !expiraCache) return;
    const timer = setTimeout(() => {
      setBoletas([]);
      setMaterias([]);
      setMateriales({});
      setSinConexion(false);
      setError("La copia temporal venció. Conéctate y vuelve a consultar tus documentos.");
    }, Math.max(0, expiraCache - Date.now()));
    return () => clearTimeout(timer);
  }, [sinConexion, expiraCache]);

  const cargar = useCallback(() => {
    if (!sesion?.sub) return;
    solicitudCarpeta.current++;
    setMateriales({});
    setCarpetaAbierta(null);
    setCargandoCarpeta(null);
    setCargando(true);
    setError("");
    void lectura.current.cargar(
      async () => {
        const [b, m] = await Promise.allSettled([
          leerConCache("/reportes/mis-boletas", () => api.get<Boleta[]>("/reportes/mis-boletas")),
          leerConCache("/alumnos/me/materias", () => api.get<Materia[]>("/alumnos/me/materias")),
        ]);
        return { b, m };
      },
      ({ b, m }) => {
        const errores: string[] = [];
        const copias: number[] = [];
        if (b.status === "fulfilled") {
          setBoletas(b.value.data);
          if (b.value.offline) copias.push(b.value.fecha);
        } else {
          setBoletas([]);
          errores.push("boletas: " + mensajeDeError(b.reason));
        }
        if (m.status === "fulfilled") {
          setMaterias(m.value.data);
          if (m.value.offline) copias.push(m.value.fecha);
        } else {
          setMaterias([]);
          errores.push("materias: " + mensajeDeError(m.reason));
        }
        setSinConexion(copias.length > 0);
        setExpiraCache(copias.length ? Math.min(...copias) + VIDA_CACHE : 0);
        setError(errores.join(" · "));
        setInicialCompleta(true);
      },
      (fallo) => setError(mensajeDeError(fallo)),
      () => setCargando(false),
    );
  }, [sesion?.sub]);

  useFocusEffect(useCallback(() => {
    aperturaEnCurso.current = false;
    setAbriendo(false);
    cargar();
    return () => {
      lectura.current.invalidar();
      solicitudCarpeta.current++;
      solicitudArchivo.current++;
      aperturaEnCurso.current = false;
    };
  }, [cargar]));

  const abrirCarpeta = async (id: number, forzar = false) => {
    solicitudCarpeta.current++;
    const actual = solicitudCarpeta.current;
    setErrorCarpeta("");
    if (carpetaAbierta === id && !forzar) {
      setCarpetaAbierta(null);
      setCargandoCarpeta(null);
      return;
    }
    setCarpetaAbierta(id);
    if (materiales[id] && !forzar) return;
    setCargandoCarpeta(id);
    try {
      const resultado: Lectura<Material[]> = await leerConCache(
        `/grupo-materias/${id}/materiales`,
        () => api.get<Material[]>(`/grupo-materias/${id}/materiales`),
      );
      if (actual !== solicitudCarpeta.current) return;
      setMateriales((anterior) => ({ ...anterior, [id]: resultado.data }));
      if (resultado.offline) {
        setSinConexion(true);
        setExpiraCache((anterior) => anterior
          ? Math.min(anterior, resultado.fecha + VIDA_CACHE)
          : resultado.fecha + VIDA_CACHE);
      }
    } catch (fallo) {
      if (actual === solicitudCarpeta.current) setErrorCarpeta(mensajeDeError(fallo));
    } finally {
      if (actual === solicitudCarpeta.current) setCargandoCarpeta(null);
    }
  };

  const abrirArchivo = async (tipo: "boleta" | "material", id: number, cicloId?: number) => {
    if (aperturaEnCurso.current || sinConexion || !sesion?.sub) return;
    aperturaEnCurso.current = true;
    const actual = ++solicitudArchivo.current;
    setAbriendo(true);
    setError("");
    try {
      const url = tipo === "boleta"
        ? (await api.get<{ url: string }>("/reportes/mi-boleta/enlace", {
            params: { cicloId, inscripcionId: id, formato: "informativa-pdf" },
          })).data.url
        : (await api.get<{ url: string }>(`/archivos/materiales/${id}/enlace`)).data.url;
      if (actual !== solicitudArchivo.current) return;
      await Linking.openURL(resolverEnlacePrivado(archivosBase, url, tipo,
        tipo === "material" ? id : undefined));
    } catch (fallo) {
      if (actual === solicitudArchivo.current) setError(mensajeDeError(fallo));
    } finally {
      if (actual === solicitudArchivo.current) {
        aperturaEnCurso.current = false;
        setAbriendo(false);
      }
    }
  };

  return (
    <ScrollView style={base.pantalla}
      refreshControl={<RefreshControl refreshing={cargando} onRefresh={cargar} />}>
      <GuiaPantalla titulo="Mis documentos"
        detalle="Descarga boletas informativas en PDF y abre materiales de clase mediante enlaces privados. Se requiere internet; no se guardan documentos dentro de la app." />
      {sinConexion && <Text accessibilityRole="alert" style={estilos.aviso}>
        Sin conexión: muestra temporal disponible durante un máximo de cinco minutos. Para abrir o descargar archivos necesitas internet.
      </Text>}
      {error !== "" && <ErrorCarga mensaje={error} reintentar={cargar} />}
      {cargando && !inicialCompleta && <ActivityIndicator accessibilityLabel="Cargando documentos" />}
      {abriendo && <Text accessibilityRole="text">Solicitando enlace privado…</Text>}
      <Text accessibilityRole="header" style={estilos.tituloSeccion}>Boletas por ciclo escolar</Text>
      {inicialCompleta && boletas.length === 0 && <Vacio mensaje="No hay boletas de inscripciones disponibles." />}
      {boletas.map((b) => (
        <TouchableOpacity key={b.inscripcionId} style={estilos.carpeta}
          accessibilityRole="button" accessibilityLabel={`Abrir boleta PDF de ${b.ciclo}, ${b.grupo}`}
          accessibilityState={{ disabled: abriendo || sinConexion }}
          disabled={abriendo || sinConexion}
          onPress={() => { void abrirArchivo("boleta", b.inscripcionId, b.cicloId); }}>
          <Text style={base.tituloTarjeta}>📄 Boleta · {b.ciclo}</Text>
          <Text style={base.secundario}>{b.grupo} · {b.plantel} · PDF informativo para descarga</Text>
        </TouchableOpacity>
      ))}
      <Text accessibilityRole="header" style={estilos.tituloSeccion}>Materiales de mis materias</Text>
      {inicialCompleta && materias.length === 0 && <Vacio mensaje="Aún no hay materias asignadas con carpetas de materiales." />}
      {materias.map((m) => (
        <Tarjeta key={m.id}>
          <TouchableOpacity style={estilos.botonCarpeta} accessibilityRole="button"
            accessibilityLabel={`${carpetaAbierta === m.id ? "Cerrar" : "Abrir"} carpeta ${m.materia.nombre}`}
            accessibilityState={{ expanded: carpetaAbierta === m.id }}
            onPress={() => { void abrirCarpeta(m.id); }}>
            <Text style={base.tituloTarjeta}>📁 {m.materia.clave} · {m.materia.nombre}</Text>
            <Text style={base.secundario}>{m.grupo.nombre} · Ciclo {m.grupo.ciclo.clave}</Text>
          </TouchableOpacity>
          {carpetaAbierta === m.id && (
            <View>
              {cargandoCarpeta === m.id && <ActivityIndicator accessibilityLabel="Cargando carpeta" />}
              {errorCarpeta !== "" && <ErrorCarga mensaje={errorCarpeta}
                reintentar={() => { void abrirCarpeta(m.id, true); }} />}
              {materiales[m.id]?.length === 0 && <Text style={base.secundario}>Esta carpeta está vacía.</Text>}
              {materiales[m.id]?.map((archivo) => (
                <TouchableOpacity key={archivo.id} style={estilos.documento}
                  accessibilityRole="button" accessibilityLabel={`Abrir ${archivo.titulo}`}
                  accessibilityState={{ disabled: abriendo || sinConexion }}
                  disabled={abriendo || sinConexion}
                  onPress={() => { void abrirArchivo("material", archivo.id); }}>
                  <Text style={base.tituloTarjeta}>📄 {archivo.titulo}</Text>
                  <Text style={base.secundario}>{archivo.archivoNombre} · {archivo.tamanoKb} KB</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </Tarjeta>
      ))}
      <Text style={estilos.nota}>Los PDF se entregan desde el servidor al navegador o gestor de archivos del teléfono; su destino depende del sistema operativo. No se almacenan en la caché de la app. La boleta informativa exige calificaciones P1–P3 completas y cerradas.</Text>
      <View style={{ height: espacio.xl }} />
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  tituloSeccion: { color: colores.tinta, fontSize: 17, fontWeight: "700", marginTop: espacio.md, marginBottom: espacio.md },
  carpeta: { backgroundColor: "#fff", borderWidth: 1, borderColor: colores.linea,
    borderRadius: radio.md, padding: espacio.lg, marginBottom: espacio.md, minHeight: 64, justifyContent: "center" },
  botonCarpeta: { minHeight: 52, justifyContent: "center" },
  documento: { minHeight: 48, justifyContent: "center", paddingVertical: espacio.sm,
    borderTopWidth: 1, borderTopColor: colores.linea, marginTop: espacio.sm },
  aviso: { color: colores.avisoTexto, marginBottom: espacio.md },
  nota: { color: colores.gris, marginTop: espacio.lg, marginBottom: espacio.md },
});
