import { useCallback, useState } from 'react';
import { Linking, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Text } from './Texto';
import { Paginador } from './Paginador';
import { api, archivosBase, mensajeDeError } from '../api/client';
import { resolverEnlacePrivado } from '../api/enlaces-privados';
import { useSesion } from '../sesion';
import { base } from '../screens/comunes';
interface Tema { id: number; indice: number; titulo: string; contenido: string; parcial: number | null; enlace: string | null; hasta: string | null; adjuntos: { id: number; archivoNombre: string }[] }
export function TemarioClase({ claseId }: { claseId: number }) {
  const { sesion } = useSesion();
  const [abierto, setAbierto] = useState(false);
  return <View><TouchableOpacity style={[base.tarjeta, { minHeight: 44 }]} accessibilityRole="button" onPress={() => setAbierto(v => !v)}><Text>{abierto ? 'Ocultar temario de esta clase' : 'Ver temario de esta clase'}</Text></TouchableOpacity>{abierto && <Temas key={String(claseId) + ':' + sesion?.sub} claseId={claseId} />}</View>;
}
function Temas({ claseId }: { claseId: number }) {
  const { sesion } = useSesion(), [pagina, setPagina] = useState(1), [datos, setDatos] = useState<Tema[]>([]), [total, setTotal] = useState(0), [cargando, setCargando] = useState(false), [error, setError] = useState(''), [intento, setIntento] = useState(0);
  useFocusEffect(useCallback(() => { let vigente = true; setDatos([]); setTotal(0); setError(''); setCargando(true); api.get(`/grupo-materias/${claseId}/temario`, { params: { pagina, porPagina: 10 } }).then(r => { if (vigente) { setDatos(r.data.datos); setTotal(r.data.total); } }).catch(e => { if (vigente) setError(mensajeDeError(e)); }).finally(() => { if (vigente) setCargando(false); }); return () => { vigente = false; }; }, [claseId, pagina, sesion?.sub, intento]));
  const abrirArchivo = async (id: number) => { try { const { data } = await api.get<{ url: string }>(`/archivos/temarios/${id}/enlace`); await Linking.openURL(resolverEnlacePrivado(archivosBase, data.url, 'temario', id)); } catch (e) { setError(mensajeDeError(e)); } };
  return <View><Text accessibilityRole="header">Temario publicado</Text><Text>Contenido de estudio; no genera tareas ni modifica notas. Requiere conexión.</Text>
    {cargando && <Text accessibilityLiveRegion="polite">Cargando temas…</Text>}{error && <View><Text accessibilityRole="alert">{error}</Text><TouchableOpacity style={{ minHeight: 44 }} accessibilityRole="button" onPress={() => setIntento(v => v + 1)}><Text>Reintentar temario</Text></TouchableOpacity></View>}
    {!cargando && !error && datos.length === 0 && <Text>No hay temas publicados disponibles.</Text>}
    {datos.map(t => <View key={t.id} style={base.tarjeta}><Text accessibilityRole="header">{t.indice}. {t.titulo}</Text><Text>{t.contenido}</Text>{t.parcial && <Text>Parcial informativo {t.parcial}</Text>}{t.hasta && <Text>Disponible hasta {new Date(t.hasta).toLocaleString()}</Text>}{t.enlace && <TouchableOpacity style={{ minHeight: 44 }} accessibilityRole="link" onPress={() => { if (t.enlace?.toLowerCase().startsWith('https://')) void Linking.openURL(t.enlace).catch(e => setError(mensajeDeError(e))); }}><Text>Abrir referencia de {t.titulo}</Text></TouchableOpacity>}{t.adjuntos.map(a => <TouchableOpacity key={a.id} style={{ minHeight: 44 }} accessibilityRole="button" onPress={() => { void abrirArchivo(a.id); }}><Text>Descargar {a.archivoNombre}</Text></TouchableOpacity>)}</View>)}
    <Paginador pagina={pagina} total={total} ocupado={cargando} cambiar={setPagina} />
  </View>;
}
