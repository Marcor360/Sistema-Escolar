import { crearControlLectura } from '../api/lectura-vigente';
import { useCallback, useRef, useState } from 'react';
import { Alert, Linking, ScrollView, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api, mensajeDeError } from '../api/client';
import { colores } from '../theme';
import { pesos } from '../formato';
import { base, ErrorCarga, Sello, Tarjeta, Vacio } from './comunes';

interface CargoDetalle {
  id: number; descripcion: string; fechaVencimiento: string | null;
  estatus: string; total: number; pagado: number; saldo: number;
}
interface Estado {
  saldoTotal: number;
  cargos: CargoDetalle[];
  pagos: { id: number; monto: number; metodo: string; fechaPago: string; estatus: string; aplicado: boolean }[];
}

export default function EstadoCuentaScreen() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [ultimaActualizacion, setUltimaActualizacion] = useState<string | null>(null);
  const [pagando, setPagando] = useState(false);

  const lectura = useRef(crearControlLectura());
  const cargar = useCallback(() => {
    setError('');
    setCargando(true);
    void lectura.current.cargar(() => api.get<Estado>('/finanzas/me/estado-cuenta'),
      (r) => { setEstado(r.data); setUltimaActualizacion(new Date().toLocaleString()); },
      (fallo) => setError(mensajeDeError(fallo)),
      () => setCargando(false));
  }, []);

  useFocusEffect(useCallback(() => { cargar(); return () => lectura.current.invalidar(); }, [cargar]));

  const pagoEnCurso = useRef(false);
  const pagarEnLinea = async (cargo: CargoDetalle) => {
    if (pagoEnCurso.current) return; pagoEnCurso.current = true;
    setPagando(true);
    try {
      const { data } = await api.post('/finanzas/ordenes', { cargoId: cargo.id });
      if (data.estatus === 'COMPLETADA') {
        Alert.alert('Pago confirmado', 'El pago ya quedó registrado. Se actualizará tu estado de cuenta.'); cargar();
      } else if (data.urlPago) {
        await Linking.openURL(data.urlPago);
      } else {
        Alert.alert('Orden creada', 'La pasarela no devolvió una URL de pago. Consulta a finanzas.');
      }
    } catch (err) {
      Alert.alert('No se pudo generar la orden', mensajeDeError(err));
    } finally { pagoEnCurso.current = false; setPagando(false); }
  };

  const tono = (estatus: string) =>
    estatus === 'PAGADO' ? 'ok' : estatus === 'VENCIDO' ? 'mal' : estatus === 'PARCIAL' ? 'aviso' : 'neutro';

  return (
    <ScrollView
      style={base.pantalla}
      refreshControl={<RefreshControl refreshing={cargando} onRefresh={cargar} />}
    >
      {error !== '' && <ErrorCarga mensaje={error} reintentar={cargar} />}
      {ultimaActualizacion && <Text accessibilityRole="text">Última actualización: {ultimaActualizacion}</Text>}
      {estado && (
        <>
          <View style={estilos.resumen}>
            <Text style={estilos.resumenEtiqueta}>Saldo pendiente</Text>
            <Text style={estilos.resumenValor}>{pesos(estado.saldoTotal)}</Text>
          </View>

          {estado.cargos.length === 0 && <Vacio mensaje="No tienes cargos registrados." />}
          {estado.cargos.map((c) => (
            <Tarjeta key={c.id}>
              <Text style={base.tituloTarjeta}>{c.descripcion}</Text>
              <Text style={base.secundario}>
                {c.fechaVencimiento ? `Vence: ${c.fechaVencimiento} · ` : ''}
                Total {pesos(c.total)} · Pagado {pesos(c.pagado)}
              </Text>
              <Text style={[base.monto, { marginTop: 4 }]}>Saldo: {pesos(c.saldo)}</Text>
              <Sello texto={c.estatus} tono={tono(c.estatus)} />
              {c.saldo > 0 && (
                <TouchableOpacity
                  disabled={pagando}
                  style={estilos.boton}
                  onPress={() => pagarEnLinea(c)}
                  accessibilityRole="button"
                  accessibilityLabel={`Pagar ${c.descripcion} en línea. Saldo ${pesos(c.saldo)}`}
                >
                  <Text style={estilos.botonTexto}>Pagar en línea</Text>
                </TouchableOpacity>
              )}
            </Tarjeta>
          ))}

          {estado.pagos.length > 0 && (
            <>
              <Text style={estilos.subtitulo}>Historial de pagos</Text>
              {estado.pagos.map((p) => (
                <Tarjeta key={p.id}>
                  <Text style={base.tituloTarjeta}>{pesos(p.monto)}</Text>
                  <Text style={base.secundario}>
                    {p.estatus}{p.estatus === 'CONFIRMADO' && !p.aplicado ? ' · Pendiente de aplicación por Finanzas' : ''} · {p.metodo} · {new Date(p.fechaPago).toLocaleDateString('es-MX')}
                  </Text>
                </Tarjeta>
              ))}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  resumen: {
    backgroundColor: colores.pizarra, padding: 18, marginBottom: 14,
    borderLeftWidth: 4, borderLeftColor: colores.dorado,
  },
  resumenEtiqueta: { color: '#C8D2CD', fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase' },
  resumenValor: { color: '#fff', fontSize: 28, fontVariant: ['tabular-nums'] },
  subtitulo: { fontSize: 13, color: colores.gris, textTransform: 'uppercase', letterSpacing: 0.6, marginVertical: 10 },
  boton: {
    marginTop: 10, alignSelf: 'flex-start', backgroundColor: colores.dorado,
    minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 8,
  },
  botonTexto: { color: colores.pizarraOscuro, fontSize: 13, fontWeight: '600' },
});
