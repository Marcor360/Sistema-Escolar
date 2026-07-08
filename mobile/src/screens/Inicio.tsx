import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/client';
import { useSesion } from '../sesion';
import { colores } from '../theme';
import { pesos } from '../formato';
import { base, Tarjeta } from './comunes';

interface Tarea { id: number; entrega: { estatus: string } | null }
interface Estado { saldoTotal: number }
interface Aviso { id: number; titulo: string; mensaje: string; leida: boolean; createdAt: string }
interface Evento { id: number; titulo: string; tipo: string; fechaInicio: string }

export default function InicioScreen() {
  const { sesion } = useSesion();
  const [pendientes, setPendientes] = useState(0);
  const [saldo, setSaldo] = useState(0);
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(() => {
    setCargando(true);
    const hoy = new Date().toISOString();
    const en30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    Promise.all([
      api.get<Tarea[]>('/alumnos/me/tareas'),
      api.get<Estado>('/finanzas/me/estado-cuenta'),
      api.get<Aviso[]>('/notificaciones/mias'),
      api.get<Evento[]>('/calendario', { params: { desde: hoy, hasta: en30 } }),
    ])
      .then(([tareas, estado, notifs, cal]) => {
        setPendientes(tareas.data.filter((t) => !t.entrega).length);
        setSaldo(estado.data.saldoTotal);
        setAvisos(notifs.data);
        setEventos(cal.data);
      })
      .finally(() => setCargando(false));
  }, []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const leerAviso = async (aviso: Aviso) => {
    if (aviso.leida) return;
    await api.patch(`/notificaciones/${aviso.id}/leer`);
    setAvisos((previos) => previos.map((a) => (a.id === aviso.id ? { ...a, leida: true } : a)));
  };

  const nombre = sesion?.nombre.split(' ')[0] ?? '';

  return (
    <ScrollView
      style={base.pantalla}
      refreshControl={<RefreshControl refreshing={cargando} onRefresh={cargar} />}
    >
      <Text style={estilos.saludo}>Hola, {nombre}</Text>

      <View style={estilos.resumen}>
        <View style={estilos.kpi}>
          <Text style={estilos.kpiValor}>{pendientes}</Text>
          <Text style={estilos.kpiEtiqueta}>Tareas por entregar</Text>
        </View>
        <View style={estilos.kpi}>
          <Text style={estilos.kpiValor}>{pesos(saldo)}</Text>
          <Text style={estilos.kpiEtiqueta}>Saldo pendiente</Text>
        </View>
      </View>

      <Text style={estilos.subtitulo}>Avisos</Text>
      {avisos.length === 0 && <Text style={base.secundario}>Sin avisos por ahora.</Text>}
      {avisos.slice(0, 5).map((aviso) => (
        <TouchableOpacity key={aviso.id} onPress={() => leerAviso(aviso)} activeOpacity={0.7}>
          <View style={[estilos.aviso, !aviso.leida && estilos.avisoSinLeer]}>
            <Text style={base.tituloTarjeta}>{aviso.titulo}</Text>
            <Text style={base.secundario}>{aviso.mensaje}</Text>
            <Text style={estilos.fecha}>
              {new Date(aviso.createdAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
            </Text>
          </View>
        </TouchableOpacity>
      ))}

      <Text style={estilos.subtitulo}>Próximos eventos</Text>
      {eventos.length === 0 && <Text style={[base.secundario, { marginBottom: 24 }]}>Sin eventos en los próximos 30 días.</Text>}
      {eventos.slice(0, 5).map((ev) => (
        <Tarjeta key={ev.id}>
          <Text style={base.tituloTarjeta}>{ev.titulo}</Text>
          <Text style={base.secundario}>
            {ev.tipo} · {new Date(ev.fechaInicio).toLocaleString('es-MX', {
              day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
            })}
          </Text>
        </Tarjeta>
      ))}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  saludo: { fontSize: 22, color: colores.tinta, marginBottom: 12, fontWeight: '600' },
  resumen: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  kpi: {
    flex: 1,
    backgroundColor: colores.pizarra,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: colores.dorado,
  },
  kpiValor: { color: '#fff', fontSize: 21, fontVariant: ['tabular-nums'], fontWeight: '600' },
  kpiEtiqueta: { color: '#C8D2CD', fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 2 },
  subtitulo: {
    fontSize: 12,
    color: colores.gris,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginTop: 6,
  },
  aviso: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colores.linea,
    padding: 14,
    marginBottom: 10,
  },
  avisoSinLeer: { borderLeftWidth: 3, borderLeftColor: colores.dorado, backgroundColor: '#FDFBF5' },
  fecha: { fontSize: 11, color: colores.gris, marginTop: 4 },
});
