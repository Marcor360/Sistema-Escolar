import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/client';
import { base, Tarjeta, Vacio } from './comunes';

interface Calificacion {
  id: number;
  parcial: number;
  calificacion: number;
  grupoMateria: { materia: { clave: string; nombre: string } };
}

export default function CalificacionesScreen() {
  const [registros, setRegistros] = useState<Calificacion[]>([]);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(() => {
    setCargando(true);
    api.get<Calificacion[]>('/calificaciones/mias')
      .then((r) => setRegistros(r.data))
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
      <FlatList
        data={filas}
        keyExtractor={([clave]) => clave}
        refreshControl={<RefreshControl refreshing={cargando} onRefresh={cargar} />}
        ListEmptyComponent={<Vacio mensaje="Aún no hay calificaciones capturadas." />}
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
