import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import { api, mensajeDeError } from '../api/client';
import { colores } from '../theme';
import { base, ErrorCarga, Sello, Tarjeta, Vacio } from './comunes';

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
  const [cargaInicialCompleta, setCargaInicialCompleta] = useState(false);
  const [error, setError] = useState('');
  const [ultimaActualizacion, setUltimaActualizacion] = useState<string | null>(null);
  const [entregandoId, setEntregandoId] = useState<number | null>(null);

  const cargar = useCallback(() => {
    setError('');
    setCargando(true);
    api.get<Tarea[]>('/alumnos/me/tareas')
      .then((r) => { setTareas(r.data); setUltimaActualizacion(new Date().toLocaleString()); setCargaInicialCompleta(true); })
      .catch((fallo) => setError(mensajeDeError(fallo)))
      .finally(() => setCargando(false));
  }, []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const entregar = async (tarea: Tarea) => {
    try {
      setEntregandoId(tarea.id);
      const resultado = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (resultado.canceled || !resultado.assets[0]) return;
      const archivo = resultado.assets[0];

      const form = new FormData();
      form.append('archivo', {
        uri: archivo.uri,
        name: archivo.name,
        type: archivo.mimeType ?? 'application/octet-stream',
      } as unknown as Blob);

      await api.post(`/actividades/${tarea.id}/entrega`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      Alert.alert('Entrega enviada', `"${tarea.titulo}" quedó registrada.`);
      cargar();
    } catch (err) {
      Alert.alert('No se pudo entregar', mensajeDeError(err));
    } finally {
      setEntregandoId(null);
    }
  };

  const solicitarEntrega = (tarea: Tarea) => {
    if (entregandoId !== null) return;
    if (tarea.entrega?.estatus === 'CALIFICADA') {
      Alert.alert('Entrega calificada', 'La entrega ya fue evaluada y no puede reemplazarse. Consulta al docente si necesitas una corrección.');
      return;
    }
    void entregar(tarea);
  };

  const tono = (tarea: Tarea) => {
    if (!tarea.entrega) return 'neutro' as const;
    if (tarea.entrega.estatus === 'CALIFICADA') return 'ok' as const;
    if (tarea.entrega.estatus === 'TARDE') return 'mal' as const;
    return 'aviso' as const;
  };

  return (
    <View style={base.pantalla}>
      {error !== '' && <ErrorCarga mensaje={error} reintentar={cargar} />}
      {ultimaActualizacion && <Text accessibilityRole="text">Última actualización: {ultimaActualizacion}</Text>}
      <FlatList
        data={tareas}
        keyExtractor={(t) => String(t.id)}
        refreshControl={<RefreshControl refreshing={cargando} onRefresh={cargar} />}
        ListEmptyComponent={cargaInicialCompleta && !error
          ? <Vacio mensaje="Sin tareas pendientes por ahora." />
          : !cargaInicialCompleta && !error ? <ActivityIndicator accessibilityLabel="Cargando tareas" /> : null}
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
            <TouchableOpacity
              style={estilos.boton}
              onPress={() => solicitarEntrega(item)}
              disabled={entregandoId !== null || item.entrega?.estatus === 'CALIFICADA'}
              accessibilityRole="button"
              accessibilityLabel={`${item.entrega ? 'Reemplazar entrega' : 'Entregar archivo'}: ${item.titulo}`}
            >
              <Text style={estilos.botonTexto}>{entregandoId === item.id ? 'Enviando…' : item.entrega ? 'Reemplazar entrega' : 'Entregar archivo'}</Text>
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
    minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 8,
  },
  botonTexto: { color: '#fff', fontSize: 13 },
});
