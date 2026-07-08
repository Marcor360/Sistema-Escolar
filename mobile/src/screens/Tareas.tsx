import { useCallback, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import { api, mensajeDeError } from '../api/client';
import { colores } from '../theme';
import { base, Sello, Tarjeta, Vacio } from './comunes';

interface Tarea {
  id: number;
  titulo: string;
  tipo: string;
  parcial: number;
  fechaEntrega: string | null;
  grupoMateria?: { materia?: { clave: string; nombre: string } };
  entrega: { estatus: string; calificacion: number | null } | null;
}

export default function TareasScreen() {
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(() => {
    setCargando(true);
    api.get<Tarea[]>('/alumnos/me/tareas')
      .then((r) => setTareas(r.data))
      .finally(() => setCargando(false));
  }, []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const entregar = async (tarea: Tarea) => {
    const resultado = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (resultado.canceled || !resultado.assets[0]) return;
    const archivo = resultado.assets[0];

    const form = new FormData();
    form.append('archivo', {
      uri: archivo.uri,
      name: archivo.name,
      type: archivo.mimeType ?? 'application/octet-stream',
    } as unknown as Blob);

    try {
      await api.post(`/actividades/${tarea.id}/entrega`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      Alert.alert('Entrega enviada', `"${tarea.titulo}" quedó registrada.`);
      cargar();
    } catch (err) {
      Alert.alert('No se pudo entregar', mensajeDeError(err));
    }
  };

  const tono = (tarea: Tarea) => {
    if (!tarea.entrega) return 'neutro' as const;
    if (tarea.entrega.estatus === 'CALIFICADA') return 'ok' as const;
    if (tarea.entrega.estatus === 'TARDE') return 'mal' as const;
    return 'aviso' as const;
  };

  return (
    <View style={base.pantalla}>
      <FlatList
        data={tareas}
        keyExtractor={(t) => String(t.id)}
        refreshControl={<RefreshControl refreshing={cargando} onRefresh={cargar} />}
        ListEmptyComponent={<Vacio mensaje="Sin tareas pendientes por ahora." />}
        renderItem={({ item }) => (
          <Tarjeta>
            <Text style={base.tituloTarjeta}>{item.titulo}</Text>
            {item.grupoMateria?.materia && (
              <Text style={base.secundario}>
                {item.grupoMateria.materia.clave} — {item.grupoMateria.materia.nombre}
              </Text>
            )}
            <Text style={base.secundario}>
              {item.tipo} · Parcial {item.parcial}
              {item.fechaEntrega ? ` · Entrega: ${new Date(item.fechaEntrega).toLocaleString('es-MX')}` : ''}
            </Text>
            <Sello
              texto={item.entrega ? `${item.entrega.estatus}${item.entrega.calificacion !== null ? ` · ${item.entrega.calificacion}` : ''}` : 'Sin entregar'}
              tono={tono(item)}
            />
            <TouchableOpacity style={estilos.boton} onPress={() => entregar(item)}>
              <Text style={estilos.botonTexto}>{item.entrega ? 'Reemplazar entrega' : 'Entregar archivo'}</Text>
            </TouchableOpacity>
          </Tarjeta>
        )}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  boton: {
    marginTop: 10, alignSelf: 'flex-start', backgroundColor: colores.pizarra,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  botonTexto: { color: '#fff', fontSize: 13 },
});
