import { useMarca } from "../marca";
import { useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, TouchableOpacity, View } from 'react-native';
import { Text } from '../components/Texto';
import { api, mensajeDeError } from '../api/client';
import { colores, textoSobreFondo } from '../theme';

export interface DocumentoInstitucional {
  clave: 'REGLAMENTO_ACADEMICO' | 'POLITICAS_INSTITUCIONALES';
  titulo: string;
  url: string;
  version: string;
  aceptadoEn: string | null;
}
export interface EstadoConsentimiento { habilitado: boolean; pendiente: boolean; documentos: DocumentoInstitucional[] }

export default function ConsentimientoInstitucional({ estado, actualizar, salir }: {
  estado: EstadoConsentimiento; actualizar: (estado: EstadoConsentimiento) => void; salir: () => void;
}) {
  const { marca } = useMarca();
  const [marcados, setMarcados] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const pendientes = estado.documentos.filter(d => !d.aceptadoEn);
  const completo = pendientes.every(d => marcados.includes(d.clave));
  const aceptar = async () => {
    if (!completo || enviando) return;
    setEnviando(true); setError('');
    try {
      const versiones = Object.fromEntries(estado.documentos.map(d => [d.clave, d.version]));
      const { data } = await api.post<EstadoConsentimiento>('/auth/consentimiento', { versiones });
      actualizar(data);
    } catch (e) { setError(mensajeDeError(e)); }
    finally { setEnviando(false); }
  };
  return <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40, gap: 16, backgroundColor: colores.papel, flexGrow: 1 }}>
    <Text accessibilityRole="header" style={{ fontSize: 24, fontWeight: '700', color: colores.tinta }}>Reglamento y políticas institucionales</Text>
    <Text>Antes de continuar, revisa y acepta ambos documentos oficiales. Tu aceptación se registrará con fecha y hora del servidor.</Text>
    {estado.documentos.map(d => <View key={d.clave} style={{ borderWidth: 1, borderColor: colores.linea, borderRadius: 12, padding: 16, gap: 10 }}>
      <Text style={{ fontWeight: '700' }}>{d.titulo} · versión {d.version}</Text>
      <TouchableOpacity accessibilityRole="link" accessibilityLabel={`Ver ${d.titulo}`} onPress={() => void Linking.openURL(d.url).catch(() => setError('No se pudo abrir la página institucional.'))} style={{ minHeight: 44, justifyContent: 'center' }}>
        <Text style={{ color: marca.colorPrimario, textDecorationLine: 'underline' }}>Ver {d.titulo.toLowerCase()} en la página institucional</Text>
      </TouchableOpacity>
      {d.aceptadoEn ? <Text>Registrado: {new Date(d.aceptadoEn).toLocaleString('es-MX')}</Text> :
        <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: marcados.includes(d.clave), disabled: enviando }} onPress={() => setMarcados(prev => prev.includes(d.clave) ? prev.filter(x => x !== d.clave) : [...prev, d.clave])} style={{ minHeight: 48, justifyContent: 'center' }}>
          <Text>{marcados.includes(d.clave) ? '☑' : '☐'} He leído y acepto {d.titulo.toLowerCase()}</Text>
        </TouchableOpacity>}
    </View>)}
    {error ? <Text accessibilityRole="alert" style={{ color: colores.peligro }}>{error}</Text> : null}
    <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: !completo || enviando }} disabled={!completo || enviando} onPress={() => void aceptar()} style={{ minHeight: 48, borderRadius: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: !completo || enviando ? colores.gris : marca.colorPrimario }}>
      <Text style={{ color: textoSobreFondo(marca.colorPrimario), fontWeight: '700' }}>{enviando ? 'Registrando…' : 'Aceptar y continuar'}</Text>
    </TouchableOpacity>
    {enviando && <ActivityIndicator accessibilityLabel="Registrando aceptación" />}
    <TouchableOpacity accessibilityRole="button" onPress={salir} style={{ minHeight: 48, justifyContent: 'center', alignItems: 'center' }}><Text>Salir sin aceptar</Text></TouchableOpacity>
  </ScrollView>;
}
