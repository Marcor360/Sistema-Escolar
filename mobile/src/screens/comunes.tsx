import { StyleSheet, Text, View } from 'react-native';
import { colores } from '../theme';

export function Tarjeta({ children }: { children: React.ReactNode }) {
  return <View style={base.tarjeta}>{children}</View>;
}

export function Sello({ texto, tono }: { texto: string; tono: 'ok' | 'aviso' | 'mal' | 'neutro' }) {
  const color =
    tono === 'ok' ? colores.exito : tono === 'aviso' ? colores.dorado : tono === 'mal' ? colores.peligro : colores.gris;
  return (
    <Text style={[base.sello, { color, borderColor: color }]}>{texto}</Text>
  );
}

export function Vacio({ mensaje }: { mensaje: string }) {
  return <Text style={base.vacio}>{mensaje}</Text>;
}

export const base = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.papel, padding: 16 },
  tarjeta: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: colores.linea,
    padding: 14, marginBottom: 10,
  },
  tituloTarjeta: { fontSize: 15, fontWeight: '600', color: colores.tinta, marginBottom: 2 },
  secundario: { fontSize: 12.5, color: colores.gris },
  sello: {
    alignSelf: 'flex-start', borderWidth: 1, paddingHorizontal: 7, paddingVertical: 1,
    fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 6,
  },
  vacio: { color: colores.gris, textAlign: 'center', marginTop: 40, paddingHorizontal: 20 },
  monto: { fontVariant: ['tabular-nums'], fontWeight: '600', color: colores.tinta },
});
