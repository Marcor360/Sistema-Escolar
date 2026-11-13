import { useEffect, useRef, useState } from 'react';
import { Alert, Image, Modal, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './Texto';
import { IconoAlumno, type NombreIconoAlumno } from './IconoAlumno';
import { useMarca } from '../marca';
import { useSesion } from '../sesion';
import { archivosBase } from '../api/client';
import { colores } from '../theme';
import { useIdentidadAlumno } from '../portal-alumno';
import { ETIQUETAS_NAVEGACION } from '../utils/etiquetas-navegacion';

export function CabeceraAlumno({ escritorio, menuAbierto, alternarMenu, abrirPerfil }: {
  escritorio: boolean; menuAbierto: boolean; alternarMenu: () => void; abrirPerfil: () => void;
}) {
  const { marca } = useMarca();
  const { sesion } = useSesion();
  const { estatus } = useIdentidadAlumno();
  const [logoFallo, setLogoFallo] = useState(false);
  const logo = marca.logoAlumnoUrl || marca.logoUrl;
  const botonMenu = useRef<View>(null);
  const anterior = useRef(menuAbierto);
  useEffect(() => setLogoFallo(false), [logo]);
  useEffect(() => {
    const timer = anterior.current && !menuAbierto ? setTimeout(() => botonMenu.current?.focus(), 50) : undefined;
    anterior.current = menuAbierto;
    return () => { if (timer) clearTimeout(timer); };
  }, [menuAbierto]);
  const iniciales = sesion?.nombre.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('');
  return <View style={[s.cabecera, { borderTopColor: marca.colorPrimario }]}>
    <TouchableOpacity ref={botonMenu} accessibilityRole="button" accessibilityLabel={menuAbierto ? 'Cerrar menú principal' : 'Abrir menú principal'}
      accessibilityState={{ expanded: menuAbierto }} onPress={alternarMenu} style={[s.menu, { width: escritorio ? 88 : 56 }]}>
      <IconoAlumno nombre={menuAbierto ? 'close' : 'menu'} />
    </TouchableOpacity>
    <View style={s.marca}>
      {logo && !logoFallo ? <Image source={{ uri: archivosBase + logo }} resizeMode="contain" style={s.logo}
        accessibilityLabel={`Logo de ${marca.nombreInstitucion}`} onError={() => setLogoFallo(true)} /> :
        <Text style={[s.monograma, { color: marca.colorPrimario }]}>{marca.nombreCorto}</Text>}
      {escritorio && <View style={s.nombreMarca}><Text style={s.institucion}>{marca.nombreInstitucion}</Text><Text style={s.meta}>Portal del alumno</Text></View>}
    </View>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Abrir mi perfil" onPress={abrirPerfil} style={s.cuenta}>
      <View style={s.avatar}><Text style={s.iniciales}>{iniciales}</Text></View>
      {escritorio && <View style={{ flexShrink: 1 }}><Text numberOfLines={1} style={s.nombre}>{sesion?.nombre}</Text>
        <Text style={s.estado}>{estatus === 'ACTIVO' ? 'Alumno activo' : 'Mi cuenta de alumno'}</Text></View>}
      <IconoAlumno nombre="chevron" tamano={16} />
    </TouchableOpacity>
  </View>;
}

const secciones: Record<string, { titulo: string; icono: NombreIconoAlumno }> = {
  Inicio: { titulo: 'Inicio', icono: 'grid' },
  Materias: { titulo: 'Mi aula', icono: 'aula' },
  Calendario: { titulo: 'Calendario escolar', icono: 'calendar' },
  Tramites: { titulo: 'Ventanilla de trámites', icono: 'document' },
  Pagos: { titulo: 'Mis finanzas', icono: 'wallet' },
  Calificaciones: { titulo: 'Avance académico', icono: 'chart' },
  Perfil: { titulo: 'Mi perfil', icono: 'user' },
};

export function NavegacionAlumno({ state, navigation, escritorio, menuAbierto, cerrarMenu }: BottomTabBarProps & {
  escritorio: boolean; menuAbierto: boolean; cerrarMenu: () => void;
}) {
  const { marca } = useMarca();
  const { cerrar } = useSesion();
  const insets = useSafeAreaInsets();
  const [logoutEnCurso, setLogoutEnCurso] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'web' || !menuAbierto || escritorio) return;
    const teclado = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') { evento.preventDefault(); cerrarMenu(); }
    };
    document.addEventListener('keydown', teclado, true);
    return () => document.removeEventListener('keydown', teclado, true);
  }, [menuAbierto, escritorio, cerrarMenu]);
  const ruta = state.routes[state.index];
  const subruta = ruta.state?.routes[ruta.state.index ?? 0]?.name;
  const tareasActivas = ruta.name === 'Materias' && subruta === 'MisTareas';
  const ir = (nombre: string, tareas = false) => {
    const destino = state.routes.find(r => r.name === nombre);
    if (!destino) return;
    const evento = navigation.emit({ type: 'tabPress', target: destino.key, canPreventDefault: true });
    if (!evento.defaultPrevented) {
      if (nombre === 'Materias') navigation.navigate(nombre, { screen: tareas ? 'MisTareas' : 'MisMaterias' });
      else navigation.navigate(nombre);
      if (!escritorio) cerrarMenu();
    }
  };
  const salir = () => Alert.alert('Cerrar sesión', '¿Quieres cerrar tu sesión en este dispositivo?', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Cerrar sesión', onPress: () => {
      if (logoutEnCurso) return;
      setLogoutEnCurso(true);
      void cerrar().catch(() => Alert.alert('No se pudo cerrar la sesión', 'Inténtalo nuevamente.')).finally(() => setLogoutEnCurso(false));
    } },
  ]);
  const item = (nombre: string, tareas = false, compacto = false) => {
    const seccion = tareas ? { titulo: 'Tareas y entregas', icono: 'book' as const } : secciones[nombre];
    const activo = tareas ? tareasActivas : nombre === ruta.name && (nombre !== 'Materias' || !tareasActivas);
    const color = activo ? marca.colorPrimario : colores.tinta;
    return <TouchableOpacity key={tareas ? 'tareas' : nombre} accessibilityRole={tareas ? 'button' : 'tab'}
      accessibilityLabel={tareas ? 'Tareas y entregas' : ETIQUETAS_NAVEGACION[nombre] ?? seccion.titulo}
      accessibilityState={{ selected: activo }} onPress={() => ir(nombre, tareas)}
      style={[s.enlace, compacto && s.enlaceCompacto, activo && s.enlaceActivo]}>
      <IconoAlumno nombre={seccion.icono} color={color} tamano={22} />
      {!compacto && <Text style={[s.etiqueta, { color, fontWeight: activo ? '700' : '500' }]}>{seccion.titulo}</Text>}
      {activo && <View style={[s.indicador, { backgroundColor: marca.colorPrimario }]} />}
    </TouchableOpacity>;
  };
  const lateral = (expandido: boolean) => <View testID="menu-lateral-alumno" style={[s.lateral, { width: expandido ? 264 : 88 }, !escritorio && { flex: 1 }]}>
    <ScrollView contentContainerStyle={s.enlaces}>
      {expandido && <Text style={s.grupo}>MI ESPACIO</Text>}
      {item('Inicio', false, !expandido)}
      {item('Materias', false, !expandido)}
      {item('Materias', true, !expandido)}
      {item('Calendario', false, !expandido)}
      {expandido && <Text style={[s.grupo, { marginTop: 24 }]}>SERVICIOS ESCOLARES</Text>}
      {item('Tramites', false, !expandido)}
      {item('Pagos', false, !expandido)}
      {item('Calificaciones', false, !expandido)}
      {item('Perfil', false, !expandido)}
    </ScrollView>
    {expandido && <View style={s.ayuda}><Text style={s.nombre}>Estamos para ayudarte</Text><Text style={s.meta}>Consulta y da seguimiento a tus trámites desde tu ventanilla.</Text>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Abrir ventanilla de trámites" onPress={() => ir('Tramites')} style={s.ayudaBoton}>
        <Text style={{ color: marca.colorPrimario, fontWeight: '700' }}>Ir a ventanilla</Text><IconoAlumno nombre="arrow" color={marca.colorPrimario} tamano={18} />
      </TouchableOpacity></View>}
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Cerrar sesión del portal" disabled={logoutEnCurso} onPress={salir} style={[s.salir, !expandido && { justifyContent: 'center' }]}>
      <IconoAlumno nombre="logout" />{expandido && <Text style={s.etiqueta}>Cerrar sesión</Text>}
    </TouchableOpacity>
  </View>;
  if (escritorio) return lateral(menuAbierto);
  return <>
    <View style={[s.inferior, { paddingBottom: Math.max(8, insets.bottom) }]}>
      {state.routes.filter(r => ['Inicio', 'Materias', 'Calificaciones', 'Pagos', 'Perfil'].includes(r.name)).map(r => {
        const activo = r.name === ruta.name;
        const color = activo ? marca.colorPrimario : colores.gris;
        const label: Record<string, string> = { Inicio: 'Inicio', Materias: 'Aula', Calificaciones: 'Notas', Pagos: 'Cuenta', Perfil: 'Perfil' };
        return <TouchableOpacity key={r.key} accessibilityRole="tab" accessibilityLabel={ETIQUETAS_NAVEGACION[r.name]}
          accessibilityState={{ selected: activo }} onPress={() => ir(r.name)} style={s.tabInferior}>
          <IconoAlumno nombre={secciones[r.name].icono} color={color} tamano={21} /><Text style={[s.labelInferior, { color }]}>{label[r.name]}</Text>
        </TouchableOpacity>;
      })}
    </View>
    <Modal visible={menuAbierto} transparent animationType="none" onRequestClose={cerrarMenu}>
      <View style={s.fondoMenu} accessibilityViewIsModal onAccessibilityEscape={cerrarMenu}
        {...(Platform.OS === 'web' ? { onKeyDown: (e: { key: string }) => { if (e.key === 'Escape') cerrarMenu(); } } : {})}>
        <View style={[s.menuMovil, { paddingTop: insets.top }]}>
          <View style={s.tituloMenu}><Text style={s.nombre}>Tu campus digital</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel="Cerrar menú de navegación" onPress={cerrarMenu} style={s.cerrarMenu}><IconoAlumno nombre="close" /></TouchableOpacity></View>
          {lateral(true)}
        </View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Cerrar menú" style={{ flex: 1 }} onPress={cerrarMenu} />
      </View>
    </Modal>
  </>;
}

const s = StyleSheet.create({
  cabecera: { height: 80, backgroundColor: '#fff', borderTopWidth: 4, borderBottomWidth: 1, borderBottomColor: colores.linea, flexDirection: 'row', alignItems: 'center', zIndex: 2 },
  menu: { height: '100%', alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderRightColor: '#EDF0F2' },
  marca: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 22, paddingHorizontal: 24 },
  logo: { width: 92, height: 48 }, monograma: { fontSize: 32, fontWeight: '800', letterSpacing: -1 },
  nombreMarca: { borderLeftWidth: 1, borderLeftColor: colores.linea, paddingLeft: 22 },
  institucion: { fontSize: 14, fontWeight: '700', color: colores.tinta }, meta: { fontSize: 12, color: colores.gris, lineHeight: 19 },
  cuenta: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingHorizontal: 20, minHeight: 48, maxWidth: '46%' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EEF1F3', justifyContent: 'center', alignItems: 'center' },
  iniciales: { color: '#3D505A', fontSize: 13, fontWeight: '700' }, nombre: { color: colores.tinta, fontSize: 13, fontWeight: '700' },
  estado: { color: '#6B501B', backgroundColor: '#FAF0D8', paddingHorizontal: 9, paddingVertical: 3, alignSelf: 'flex-start', borderRadius: 12, marginTop: 4, fontSize: 10 },
  lateral: { flexShrink: 0, backgroundColor: '#fff', borderRightWidth: 1, borderRightColor: '#E4E8EC', minHeight: 0 },
  enlaces: { paddingHorizontal: 14, paddingVertical: 24, gap: 5 }, grupo: { color: '#6C7880', fontSize: 10, letterSpacing: 1.4, fontWeight: '700', paddingHorizontal: 12, marginBottom: 12 },
  enlace: { minHeight: 48, paddingHorizontal: 12, gap: 14, flexDirection: 'row', alignItems: 'center', borderRadius: 8, position: 'relative' },
  enlaceCompacto: { justifyContent: 'center', paddingHorizontal: 0, marginBottom: 4 }, enlaceActivo: { backgroundColor: '#F0F3F4' },
  etiqueta: { fontSize: 13, color: colores.tinta, flexShrink: 1 }, indicador: { position: 'absolute', left: -14, width: 3, height: 24, borderRadius: 2 },
  ayuda: { padding: 16, marginHorizontal: 18, borderRadius: 10, backgroundColor: '#F5F7F8', gap: 7 },
  ayudaBoton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  salir: { flexDirection: 'row', gap: 14, alignItems: 'center', minHeight: 68, paddingHorizontal: 26, marginTop: 12, borderTopWidth: 1, borderTopColor: '#EDF0F2' },
  inferior: { flexDirection: 'row', backgroundColor: '#fff', paddingTop: 10, borderTopWidth: 1, borderTopColor: colores.linea },
  tabInferior: { flex: 1, minWidth: 0, minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 5 }, labelInferior: { fontSize: 10, fontWeight: '600' },
  fondoMenu: { flex: 1, backgroundColor: 'rgba(15,30,40,.4)', flexDirection: 'row' }, menuMovil: { backgroundColor: '#fff', maxWidth: '88%', width: 264 },
  tituloMenu: { minHeight: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 24, borderBottomWidth: 1, borderBottomColor: colores.linea }, cerrarMenu: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
});
