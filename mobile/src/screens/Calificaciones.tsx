import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api, mensajeDeError } from '../api/client';
import { base, ErrorCarga, Tarjeta, Vacio } from './comunes';

interface Calificacion {
  id: number;
  parcial: number;
  calificacion: number;
  grupoMateria: { materia: { clave: string; nombre: string } };
}

export default function CalificacionesScreen() {
  const [registros, setRegistros] = useState<Calificacion[]>([]);
  const [cargando, setCargando] = useState(false);
  const [cargaInicialCompleta, setCargaInicialCompleta] = useState(false);
  const [error, setError] = useState('');

  const cargar = useCallback(() => {
    setError('');
    setCargando(true);
    api.get<Calificacion[]>('/calificaciones/mias')
      .then((r) => { setRegistros(r.data); setCargaInicialCompleta(true); })
      .catch((fallo) => setError(mensajeDeError(fallo)))
      .finally(() => setCargando(false));
  }, []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  // Agrupar por materia para lectura tipo boleta
  const materias = new Map<string, { nombre: string; parciales: Calificacion[] }>();
  for (const r of registros) {
    const clave = r.grupoMateria.materia.clave;
    const grupo = materias.get(clave) ?? { nombre: r.grupoMateria.materia.nombre, parciales: [] };
    grupo.parciales.push(r);
    materias.set(clave, grupo);
  }
  const filas = [...materias.entries()];

  return (
    <View style={base.pantalla}>
      {error !== '' && <ErrorCarga mensaje={error} reintentar={cargar} />}
      <FlatList
        data={filas}
        keyExtractor={([clave]) => clave}
        refreshControl={<RefreshControl refreshing={cargando} onRefresh={cargar} />}
        ListEmptyComponent={cargaInicialCompleta && !error
          ? <Vacio mensaje="Aún no hay calificaciones capturadas." />
          : !cargaInicialCompleta && !error ? <ActivityIndicator accessibilityLabel="Cargando calificaciones" /> : null}
        renderItem={({ item: [clave, materia] }) => {
          const promedio =
            materia.parciales.reduce((s, p) => s + p.calificacion, 0) / materia.parciales.length;
          return (
            <Tarjeta>
              <Text style={base.tituloTarjeta}>{clave} — {materia.nombre}</Text>
              {materia.parciales
                .sort((a, b) => a.parcial - b.parcial)
                .map((p) => (
                  <Text key={p.id} style={base.secundario}>
                    {p.parcial === 0 ? 'Final' : `Parcial ${p.parcial}`}: <Text style={base.monto}>{p.calificacion.toFixed(1)}</Text>
                  </Text>
                ))}
              <Text style={[base.secundario, { marginTop: 4 }]}>
                Promedio: <Text style={base.monto}>{promedio.toFixed(1)}</Text>
              </Text>
            </Tarjeta>
          );
        }}
      />
    </View>
  );
}
