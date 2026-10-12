import { crearControlLectura } from '../api/lectura-vigente';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../components/Texto';
import { useFocusEffect } from '@react-navigation/native';
import { api, mensajeDeError } from '../api/client';
import { useSesion } from '../sesion';
import { colores, radio, espacio, tipografia } from '../theme';
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
  const [cargaInicialCompleta, setCargaInicialCompleta] = useState(false);
  const [error, setError] = useState('');

  const lectura = useRef(crearControlLectura());
  const cargar = useCallback(() => {
    setError('');
    setCargando(true);
    const hoy = new Date().toISOString();
    const en30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    void lectura.current.cargar(() => Promise.all([
      api.get<Tarea[]>('/alumnos/me/tareas'),
      api.get<Estado>('/finanzas/me/estado-cuenta'),
      api.get<Aviso[]>('/notificaciones/mias'),
      api.get<Evento[]>('/calendario', { params: { desde: hoy, hasta: en30 } }),
    ]),
      ([tareas, estado, notifs, cal]) => {
        setPendientes(tareas.data.filter((t) => !t.entrega).length);
        setSaldo(estado.data.saldoTotal);
        setAvisos(notifs.data);
        setEventos(cal.data);
        setCargaInicialCompleta(true);
      },
      (fallo) => setError(mensajeDeError(fallo)),
      () => setCargando(false));
  }, []);

  useFocusEffect(useCallback(() => { cargar(); return () => lectura.current.invalidar(); }, [cargar]));

  const leerAviso = async (aviso: Aviso) => {
    if (aviso.leida) return;
    try {
      await api.patch(`/notificaciones/${aviso.id}/leer`);
      setAvisos((previos) => previos.map((a) => (a.id === aviso.id ? { ...a, leida: true } : a)));
      cargar();
    } catch (fallo) {
      setError(mensajeDeError(fallo));
    }
  };

  const nombre = sesion?.nombre.split(' ')[0] ?? '';

  return (
    <ScrollView
      style={base.pantalla}
      refreshControl={<RefreshControl refreshing={cargando} onRefresh={cargar} />}
    >
      <Text style={estilos.saludo} accessibilityRole="header">Hola, {nombre}</Text>
      <Text style={estilos.introduccion}>Aquí encontrarás tus actividades, avisos y próximos eventos.</Text>
      {error !== '' && (
        <View accessibilityRole="alert" style={estilos.error}>
          <Text style={estilos.errorTexto}>{error}</Text>
          <TouchableOpacity onPress={cargar} accessibilityRole="button" accessibilityLabel="Reintentar cargar inicio">
            <Text style={estilos.reintentar}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      )}

      {!cargaInicialCompleta && !error && <ActivityIndicator accessibilityLabel="Cargando inicio" />}
      {cargaInicialCompleta && (
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
      )}

      {cargaInicialCompleta && <Text style={estilos.subtitulo}>Avisos</Text>}
      {cargaInicialCompleta && avisos.length === 0 && <Text style={base.secundario}>Sin avisos por ahora.</Text>}
      {cargaInicialCompleta && avisos.slice(0, 5).map((aviso) => (
        <TouchableOpacity
          key={aviso.id}
          onPress={() => leerAviso(aviso)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Aviso: ${aviso.titulo}. Marcar como leído`}
        >
          <View style={[estilos.aviso, !aviso.leida && estilos.avisoSinLeer]}>
            <Text style={base.tituloTarjeta}>{aviso.titulo}</Text>
            <Text style={base.secundario}>{aviso.mensaje}</Text>
            <Text style={estilos.fecha}>
              {new Date(aviso.createdAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
            </Text>
          </View>
        </TouchableOpacity>
      ))}

      {cargaInicialCompleta && <Text style={estilos.subtitulo}>Próximos eventos</Text>}
      {cargaInicialCompleta && eventos.length === 0 && <Text style={[base.secundario, { marginBottom: 24 }]}>Sin eventos en los próximos 30 días.</Text>}
      {cargaInicialCompleta && eventos.slice(0, 5).map((ev) => (
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
  error: { borderWidth: 1, borderColor: colores.peligro, padding: 12, marginBottom: 12, backgroundColor: '#fff' },
  errorTexto: { color: colores.peligro, marginBottom: 8 },
  reintentar: { color: colores.pizarra, textDecorationLine: 'underline', fontWeight: '600' },
  saludo: { fontSize: tipografia.titulo, color: colores.tinta, marginBottom: 4, fontWeight: '700' },
  introduccion: { fontSize: tipografia.secundaria, color: colores.gris, marginBottom: espacio.xl },
  resumen: { flexDirection: 'row', gap: espacio.md, marginBottom: espacio.xl },
  kpi: {
    flex: 1,
    backgroundColor: colores.pizarra,
    padding: espacio.lg,
    borderRadius: radio.md,
    borderLeftWidth: 3,
    borderLeftColor: colores.dorado,
  },
  kpiValor: { color: '#fff', fontSize: tipografia.dato, fontVariant: ['tabular-nums'], fontWeight: '600' },
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
    borderRadius: radio.md,
    borderWidth: 1,
    borderColor: colores.linea,
    padding: espacio.lg,
    marginBottom: 10,
  },
  avisoSinLeer: { borderLeftWidth: 3, borderLeftColor: colores.dorado, backgroundColor: '#FDFBF5' },
  fecha: { fontSize: 11, color: colores.gris, marginTop: 4 },
});
