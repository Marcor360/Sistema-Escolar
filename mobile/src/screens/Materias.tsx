import { useCallback, useState } from 'react';
import { FlatList, Linking, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api, archivosBase } from '../api/client';
import { colores } from '../theme';
import { base, Sello, Tarjeta, Vacio } from './comunes';

interface Materia {
  id: number;
  materia: { clave: string; nombre: string };
  grupo: { nombre: string; ciclo: { clave: string } };
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
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [cargando, setCargando] = useState(false);
  const [abierta, setAbierta] = useState<number | null>(null);
  const [materialesPor, setMaterialesPor] = useState<Record<number, Material[]>>({});

  const cargar = useCallback(() => {
    setCargando(true);
    api.get<Materia[]>('/alumnos/me/materias')
      .then((r) => setMaterias(r.data))
      .finally(() => setCargando(false));
  }, []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  /** Despliega la materia y carga sus materiales la primera vez. */
  const alternar = async (materia: Materia) => {
    if (abierta === materia.id) { setAbierta(null); return; }
    setAbierta(materia.id);
    if (!materialesPor[materia.id]) {
      const { data } = await api.get<Material[]>(`/grupo-materias/${materia.id}/materiales`);
      setMaterialesPor((previos) => ({ ...previos, [materia.id]: data }));
    }
  };

  return (
    <View style={base.pantalla}>
      <FlatList
        data={materias}
        keyExtractor={(m) => String(m.id)}
        refreshControl={<RefreshControl refreshing={cargando} onRefresh={cargar} />}
        ListEmptyComponent={<Vacio mensaje="Aún no tienes materias: control escolar te inscribirá a un grupo." />}
        renderItem={({ item }) => {
          const desplegada = abierta === item.id;
          const materiales = materialesPor[item.id];
          return (
            <TouchableOpacity onPress={() => alternar(item)} activeOpacity={0.7}>
              <Tarjeta>
                <Text style={base.tituloTarjeta}>{item.materia.clave} — {item.materia.nombre}</Text>
                <Text style={base.secundario}>Grupo {item.grupo.nombre} · Ciclo {item.grupo.ciclo.clave}</Text>
                {item.docente
                  ? <Text style={base.secundario}>Imparte: {item.docente.usuario.nombre} {item.docente.usuario.apellidoPaterno}</Text>
                  : <Sello texto="Sin docente asignado" tono="aviso" />}

                {desplegada && (
                  <View style={estilos.materiales}>
                    <Text style={estilos.subtitulo}>Materiales de clase</Text>
                    {!materiales && <Text style={base.secundario}>Cargando…</Text>}
                    {materiales && materiales.length === 0 && (
                      <Text style={base.secundario}>El maestro aún no sube materiales.</Text>
                    )}
                    {materiales?.map((m) => (
                      <TouchableOpacity
                        key={m.id}
                        style={estilos.material}
                        onPress={() => Linking.openURL(`${archivosBase}${m.archivoRuta}`)}
                      >
                        <Text style={estilos.materialTitulo}>📄 {m.titulo}</Text>
                        <Text style={base.secundario}>{m.archivoNombre} · {m.tamanoKb} KB</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                <Text style={estilos.indicador}>{desplegada ? 'Ocultar materiales ▲' : 'Ver materiales ▼'}</Text>
              </Tarjeta>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  materiales: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colores.linea,
  },
  subtitulo: {
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colores.gris,
    marginBottom: 6,
  },
  material: { paddingVertical: 7 },
  materialTitulo: { fontSize: 13.5, color: colores.pizarra, fontWeight: '600' },
  indicador: { marginTop: 10, fontSize: 12, color: colores.dorado, fontWeight: '600' },
});
