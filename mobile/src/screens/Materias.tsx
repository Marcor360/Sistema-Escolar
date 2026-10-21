import { TemarioClase } from '../components/TemarioClase';
import { Paginador } from '../components/Paginador';
import { RecursamientosPropios } from "../components/RecursamientosPropios";
import { leerConCache } from "../api/cache-academica";
import { resolverEnlacePrivado } from "../api/enlaces-privados";
import { crearControlLectura } from "../api/lectura-vigente";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "../components/Texto";
import { useFocusEffect } from "@react-navigation/native";
import { api, archivosBase, mensajeDeError } from "../api/client";
import { useSesion } from "../sesion";
import { useMarca } from "../marca";
import { colores, radio, espacio, tipografia } from "../theme";
import {
  GuiaPantalla,
  base,
  ErrorCarga,
  Sello,
  Tarjeta,
  Vacio,
} from "./comunes";

interface Materia {
  id: number;
  materia: { clave: string; nombre: string };
  grupo: { nombre: string; tipo?: 'REGULAR' | 'ESPECIAL'; ciclo: { clave: string } };
  docente: { usuario: { nombre: string; apellidoPaterno: string } } | null;
}
interface Material {
  id: number;
  titulo: string;
  archivoNombre: string;
  archivoRuta: string;
  tamanoKb: number;
}

export default function MateriasScreen() {
  const { marca } = useMarca();
  const { sesion } = useSesion();
  const [pagina,setPagina]=useState(1),[total,setTotal]=useState(0);
  useEffect(()=>{setPagina(1);setTotal(0);},[sesion?.sub]);

  const [materias, setMaterias] = useState<Materia[]>([]);
  const [cargando, setCargando] = useState(false);
  const [cargaInicialCompleta, setCargaInicialCompleta] = useState(false);
  const [abierta, setAbierta] = useState<number | null>(null);
  const [paginasMateriales, setPaginasMateriales] = useState<Record<number, number>>({}), [totalesMateriales, setTotalesMateriales] = useState<Record<number, number>>({});
  const [materialesPor, setMaterialesPor] = useState<
    Record<number, Material[]>
  >({});
  const [cargandoMateriales, setCargandoMateriales] = useState<number | null>(
    null,
  );
  const [erroresMateriales, setErroresMateriales] = useState<
    Record<number, string>
  >({});
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
        setMaterias([]);
        setOffline(false);
        setUltimaActualizacion(null);
        setError("La copia de lectura venció. Conéctate y actualiza.");
      },
      Math.max(0, cacheExpira - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [offline, cacheExpira]);
  const lectura = useRef(crearControlLectura());
  const consultaMateriales = useRef(0);
  useEffect(() => {
    consultaMateriales.current += 1;
    lectura.current.invalidar();
    setMaterias([]);
    setAbierta(null);
    setMaterialesPor({}); setPaginasMateriales({}); setTotalesMateriales({});
    setErroresMateriales({});
    setCargandoMateriales(null);
    setCargaInicialCompleta(false);
    setUltimaActualizacion(null);
    setOffline(false);
    setCacheExpira(0);
    setError("");
    setCargando(false);
  }, [sesion?.sub]);
  const cargar = useCallback(() => {
    if (!sesion?.sub) return;
    consultaMateriales.current += 1;
    setAbierta(null);
    setMaterialesPor({}); setPaginasMateriales({}); setTotalesMateriales({});
    setErroresMateriales({});
    setCargandoMateriales(null);
    setError("");
    setMaterias([]);
    setCargando(true);
    void lectura.current.cargar(
      () =>
        leerConCache("/alumnos/me/materias/listado?pagina="+pagina, () =>
          api.get<{datos:Materia[];total:number}>("/alumnos/me/materias/listado",{params:{pagina,porPagina:10}}),
        ),
      (r) => {
        setMaterias(r.data.datos);setTotal(r.data.total);
        setOffline(r.offline);
        setCacheExpira(r.fecha + 5 * 60000);
        setUltimaActualizacion(new Date(r.fecha).toLocaleString());
        setCargaInicialCompleta(true);
      },
      (fallo) => setError(mensajeDeError(fallo)),
      () => setCargando(false),
    );
  }, [sesion?.sub,pagina]);

  useFocusEffect(
    useCallback(() => {
      cargar();
      return () => {
        lectura.current.invalidar();
        consultaMateriales.current += 1;
        setCargandoMateriales(null);
        setAbierta(null);
      };
    }, [cargar]),
  );

  const cargarMateriales = async (materiaId: number, paginaMaterial = paginasMateriales[materiaId] || 1) => {
    const actual = ++consultaMateriales.current;
    setCargandoMateriales(materiaId); setPaginasMateriales(prev => ({ ...prev, [materiaId]: paginaMaterial })); setMaterialesPor(prev => { const n = { ...prev }; delete n[materiaId]; return n; });
    setErroresMateriales((previos) => ({ ...previos, [materiaId]: "" }));
    try {
      const { data } = await api.get<{datos: Material[]; total: number}>(
        `/grupo-materias/${materiaId}/materiales/listado`, {params:{pagina:paginaMaterial,porPagina:10}}
      );
      if (actual === consultaMateriales.current) {
        setMaterialesPor((previos) => ({ ...previos, [materiaId]: data.datos })); setTotalesMateriales(prev => ({...prev,[materiaId]:data.total}));
      }
    } catch (fallo) {
      if (actual === consultaMateriales.current) {
        setErroresMateriales((previos) => ({
          ...previos,
          [materiaId]: mensajeDeError(fallo),
        }));
      }
    } finally {
      if (actual === consultaMateriales.current) setCargandoMateriales(null);
    }
  };

  const alternar = (materia: Materia) => {
    consultaMateriales.current += 1;
    setCargandoMateriales(null);
    if (abierta === materia.id) {
      setAbierta(null);
      return;
    }
    setAbierta(materia.id);
    if (!materialesPor[materia.id]) void cargarMateriales(materia.id);
  };

  /** Pide un enlace firmado de corta vida y lo abre (los materiales ya no son públicos). */
  const abrirMaterial = async (materialId: number) => {
    const actual = consultaMateriales.current;
    try {
      const { data } = await api.get<{ url: string }>(
        `/archivos/materiales/${materialId}/enlace`,
      );
      if (actual === consultaMateriales.current)
        await Linking.openURL(resolverEnlacePrivado(archivosBase, data.url, "material", materialId));
    } catch (fallo) {
      if (actual === consultaMateriales.current)
        setError(mensajeDeError(fallo));
    }
  };

  return (
    <View style={base.pantalla}>
      {error !== "" && <ErrorCarga mensaje={error} reintentar={cargar} />}
      {ultimaActualizacion && (
        <Text accessibilityRole="text">
          Última actualización: {ultimaActualizacion}
        </Text>
      )}
      {offline && (
        <Text accessibilityRole="alert">
          Sin conexión: copia de materias de esta sesión, hasta 5 minutos. Los
          archivos requieren conexión.
        </Text>
      )}
      <Paginador pagina={pagina} total={total} ocupado={cargando} cambiar={setPagina} />
      <FlatList
        ListHeaderComponent={
          <><RecursamientosPropios /><GuiaPantalla
            titulo="Mis materias"
            detalle="Toca una materia para ver al docente y abrir sus materiales de clase."
          /></>
        }
        data={materias}
        keyExtractor={(m) => String(m.id)}
        refreshControl={
          <RefreshControl refreshing={cargando} onRefresh={cargar} />
        }
        ListEmptyComponent={
          cargaInicialCompleta && !error ? (
            <Vacio mensaje="Aún no tienes materias: control escolar te inscribirá a un grupo." />
          ) : !cargaInicialCompleta && !error ? (
            <ActivityIndicator accessibilityLabel="Cargando materias" />
          ) : null
        }
        renderItem={({ item }) => {
          const desplegada = abierta === item.id;
          const materiales = materialesPor[item.id];
          return (
            <Tarjeta>
              <TouchableOpacity
              onPress={() => alternar(item)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`${item.materia.clave}: ${item.materia.nombre}. ${desplegada ? "Ocultar" : "Ver"} materiales`}
              accessibilityState={{ expanded: desplegada }}
            >
                <Text style={base.tituloTarjeta}>
                  {item.materia.clave} — {item.materia.nombre}
                </Text>
                <Text style={base.secundario}>
                  {item.grupo.tipo === 'ESPECIAL' ? 'Programa especial · ' : ''}Grupo {item.grupo.nombre} · Ciclo {item.grupo.ciclo.clave}
                </Text>
                {item.docente ? (
                  <Text style={base.secundario}>
                    Imparte: {item.docente.usuario.nombre}{" "}
                    {item.docente.usuario.apellidoPaterno}
                  </Text>
                ) : (
                  <Sello texto="Sin docente asignado" tono="aviso" />
                )}
                <Text style={estilos.indicador}>
                  {desplegada ? "Ocultar materiales ▲" : "Ver materiales ▼"}
                </Text>
              </TouchableOpacity>

                {desplegada && (
                  <View style={estilos.materiales}>
                    <TemarioClase claseId={item.id} />{(totalesMateriales[item.id] || 0) > 10 && <Paginador pagina={paginasMateriales[item.id] || 1} total={totalesMateriales[item.id]} ocupado={cargandoMateriales === item.id} cambiar={p => { void cargarMateriales(item.id,p); }} />}<Text style={estilos.subtitulo}>Materiales de clase</Text>
                    {!materiales && cargandoMateriales === item.id && (
                      <ActivityIndicator accessibilityLabel="Cargando materiales de clase" />
                    )}
                    {!!erroresMateriales[item.id] && (
                      <ErrorCarga
                        mensaje={erroresMateriales[item.id]}
                        reintentar={() => {
                          void cargarMateriales(item.id);
                        }}
                      />
                    )}
                    {materiales && materiales.length === 0 && (
                      <Text style={base.secundario}>
                        El maestro aún no sube materiales.
                      </Text>
                    )}
                    {materiales?.map((m) => (
                      <TouchableOpacity
                        key={m.id}
                        style={estilos.material}
                        onPress={() => abrirMaterial(m.id)}
                        accessibilityRole="button"
                        accessibilityLabel={`Abrir material: ${m.titulo}, ${m.archivoNombre}`}
                      >
                        <Text style={[estilos.materialTitulo, { color: marca.colorPrimario }]}>
                          📄 {m.titulo}
                        </Text>
                        <Text style={base.secundario}>
                          {m.archivoNombre} · {m.tamanoKb} KB
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </Tarjeta>
          );
        }}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  materiales: {
    marginTop: espacio.md,
    paddingTop: espacio.md,
    borderTopWidth: 1,
    borderTopColor: colores.linea,
  },
  subtitulo: {
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colores.gris,
    marginBottom: 6,
  },
  material: {
    minHeight: 48,
    justifyContent: "center",
    paddingVertical: espacio.md,
    borderRadius: radio.sm,
  },
  materialTitulo: {
    fontSize: tipografia.cuerpo,
    color: colores.pizarra,
    fontWeight: "600",
  },
  indicador: {
    marginTop: 10,
    fontSize: 12,
    color: colores.avisoTexto,
    fontWeight: "600",
  },
});
