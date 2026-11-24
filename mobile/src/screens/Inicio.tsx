import { useTemaAlumno, useEstilosAlumno, type ColoresAlumno } from "../tema-alumno";
import { PendientesBoletas } from '../components/PendientesBoletas';
import { useDisenoAlumno } from "../use-diseno-alumno";
import { PendientesAlumno } from '../components/PendientesAlumno';
import { SeguimientoAlumno } from '../components/SeguimientoAlumno';
import { CalendarioCiclo } from '../components/CalendarioCiclo';
import { crearControlLectura } from "../api/lectura-vigente";
import { fechaHoraEscolar } from "../utils/fecha-evento";
import {
  obtenerResumenInicio,
  type AvisoInicio,
  type EventoInicio,
} from "./inicio-resumen";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "../components/Texto";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { api, mensajeDeError } from "../api/client";
import { useSesion } from "../sesion";
import { pesos } from "../formato";
import { useMarca } from "../marca";
import { IconoAlumno, type NombreIconoAlumno } from '../components/IconoAlumno';
import { useIdentidadAlumno } from '../portal-alumno';
import { useBase, Tarjeta } from "./comunes";

export default function InicioScreen() {
  const base = useBase();
  const { colores } = useTemaAlumno();
  const estilos = useEstilosAlumno(crearEstilos);
  const diseno = useDisenoAlumno();
  const { marca } = useMarca();
  const { matricula } = useIdentidadAlumno();
  const { sesion } = useSesion();
  const navigation = useNavigation();
  const [saldo, setSaldo] = useState<number | null>(null);
  const [avisos, setAvisos] = useState<AvisoInicio[] | null>(null);
  const [eventos, setEventos] = useState<EventoInicio[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [cargaInicialCompleta, setCargaInicialCompleta] = useState(false);
  const [error, setError] = useState("");

  const lectura = useRef(crearControlLectura());
  const cargar = useCallback(() => {
    setError("");
    setCargando(true);
    const hoy = new Date().toISOString();
    const en30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    void lectura.current.cargar(
      () => obtenerResumenInicio(hoy, en30),
      (datos) => {
        setSaldo(datos.saldo);
        setAvisos(datos.avisos);
        setEventos(datos.eventos);
        setError(
          datos.errores.length > 0
            ? `No se pudo actualizar: ${datos.errores.join(", ")}. Desliza para reintentar.`
            : "",
        );
        setCargaInicialCompleta(true);
      },
      (fallo) => setError(mensajeDeError(fallo)),
      () => setCargando(false),
    );
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar();
      return () => lectura.current.invalidar();
    }, [cargar]),
  );

  const leerAviso = async (aviso: AvisoInicio) => {
    if (aviso.leida) return;
    try {
      await api.patch(`/notificaciones/${aviso.id}/leer`);
      setAvisos(
        (previos) =>
          previos?.map((a) =>
            a.id === aviso.id ? { ...a, leida: true } : a,
          ) ?? null,
      );
      cargar();
    } catch (fallo) {
      setError(mensajeDeError(fallo));
    }
  };

  const servicios: { ruta: string; titulo: string; etiqueta: string; detalle: string; accion: string; icono: NombreIconoAlumno; fondo: string }[] = [
    { ruta: 'Materias', titulo: 'Mi aula', etiqueta: 'Materias y tareas', detalle: 'Tus materias, materiales de clase y tareas, en un mismo lugar.', accion: 'Entrar al aula', icono: 'aula', fondo: colores.suave },
    { ruta: 'Pagos', titulo: 'Mis finanzas', etiqueta: 'Estado de cuenta', detalle: 'Consulta tus cargos, pagos registrados y estado de cuenta.', accion: 'Ver mis finanzas', icono: 'wallet', fondo: colores.pizarraOscuro },
    { ruta: 'Tramites', titulo: 'Ventanilla de trámites', etiqueta: 'Ventanilla de trámites', detalle: 'Solicita documentos y consulta el seguimiento de tus trámites.', accion: 'Ir a ventanilla', icono: 'document', fondo: colores.suave },
  ];
  const navegar = (ruta: string) => navigation.navigate(ruta as never);
  const accesos: { ruta: string; titulo: string; etiqueta: string; icono: NombreIconoAlumno }[] = [
    { ruta: 'Calificaciones', titulo: 'Avance académico', etiqueta: 'Ver últimas calificaciones', icono: 'chart' },
    { ruta: 'Calendario', titulo: 'Calendario escolar', etiqueta: 'Consultar calendario escolar', icono: 'calendar' },
    { ruta: 'Perfil', titulo: 'Perfil y documentos', etiqueta: 'Perfil y documentos', icono: 'user' },
  ];
  return (
    <ScrollView contentContainerStyle={[base.contenidoLista, diseno.contenidoScroll]} style={[base.pantalla, diseno.pantallaScroll]}
      refreshControl={<RefreshControl refreshing={cargando} onRefresh={cargar} />}>
      <View style={[estilos.saludoFila, diseno.columnas === 1 && { alignItems: 'flex-start', gap: 16 }]}>
        <View style={[estilos.avatar, diseno.columnas === 1 && { width: 56, height: 56, borderRadius: 28 }]}><IconoAlumno nombre="user" tamano={diseno.columnas > 1 ? 56 : 36} color={colores.gris} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>

          <Text style={[estilos.saludo, diseno.columnas === 1 && { fontSize: 27, lineHeight: 34 }]} accessibilityRole="header">Hola, {sesion?.nombre || 'bienvenido'}</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Consultar mi perfil" onPress={() => navegar('Perfil')} style={estilos.perfilEnlace}>
            <Text style={[estilos.enlace, { color: colores.enlace }]}>Ver mi perfil</Text><IconoAlumno nombre="chevron" tamano={14} color={colores.enlace} />
          </TouchableOpacity>
          <Text style={base.secundario}>{matricula ? `Matrícula: ${matricula}` : marca.nombreInstitucion}</Text>
        </View>
        {diseno.columnas > 1 && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Acceso a mi aula" onPress={() => navegar('Materias')} style={[estilos.botonAula, { borderColor: colores.enlace }]}>
          <IconoAlumno nombre="aula" color={colores.enlace} /><Text style={[estilos.enlace, { color: colores.enlace }]}>Acceso a mi aula</Text><IconoAlumno nombre="arrow" color={colores.enlace} tamano={18} />
        </TouchableOpacity>}
      </View>

      <View style={estilos.tituloSeccion}><Text accessibilityRole="header" style={estilos.subtitulo}>Servicios</Text></View>
      <View style={estilos.grilla}>
        {servicios.map(servicio => <TouchableOpacity key={servicio.ruta} accessibilityRole="button" accessibilityLabel={servicio.etiqueta}
          accessibilityHint={servicio.detalle} onPress={() => navegar(servicio.ruta)} style={[estilos.servicio, { width: diseno.anchoAcceso }]}>
          <View style={[estilos.ilustracion, { backgroundColor: servicio.fondo }]}>
            <View style={estilos.circuloDecorativo} /><IconoAlumno nombre={servicio.icono} tamano={40} color={servicio.ruta === "Pagos" ? colores.sobrePrimarioOscuro : colores.enlace} />
            <View style={estilos.lineaDecorativa} />
          </View>
          <View style={estilos.servicioContenido}><Text style={estilos.servicioTitulo}>{servicio.titulo}</Text><Text style={[base.secundario, { fontSize: 14, lineHeight: 21 }]}>{servicio.detalle}</Text>
            <View style={estilos.accionServicio}><Text style={[estilos.accionTexto, { color: colores.enlace }]}>{servicio.accion}</Text><IconoAlumno nombre="arrow" tamano={17} color={colores.enlace} /></View>
          </View>
        </TouchableOpacity>)}
      </View>
      <View style={estilos.grilla}>
        {accesos.map(acceso => <TouchableOpacity key={acceso.ruta} accessibilityRole="button" accessibilityLabel={acceso.etiqueta}
          onPress={() => navegar(acceso.ruta)} style={[estilos.acceso, { width: diseno.anchoAcceso }]}>
          <View style={estilos.iconoAcceso}><IconoAlumno nombre={acceso.icono} color={colores.enlace} tamano={21} /></View>
          <Text style={estilos.accesoTexto}>{acceso.titulo}</Text><IconoAlumno nombre="chevron" tamano={16} color={colores.gris} />
        </TouchableOpacity>)}
      </View>

      {error !== '' && <View accessibilityRole="alert" style={estilos.error}><Text style={base.errorTexto}>{error}</Text>
        <TouchableOpacity style={base.botonAccesible} onPress={cargar} accessibilityRole="button" accessibilityLabel="Reintentar cargar inicio"><Text style={[estilos.enlace, { color: colores.enlace }]}>Reintentar</Text></TouchableOpacity>
      </View>}
      {!cargaInicialCompleta && !error && <ActivityIndicator accessibilityLabel="Cargando inicio" />}
      <View style={estilos.tituloSeccion}><Text accessibilityRole="header" style={estilos.subtitulo}>Tu día en el campus</Text></View>
      <View style={estilos.grilla}>
        <View style={{ width: diseno.columnas > 1 ? Math.floor((diseno.anchoContenido - diseno.lateral * 2 - 16) / 2) : diseno.anchoAcceso }}><PendientesAlumno /></View>
        <View style={{ flex: 1, minWidth: Math.min(diseno.anchoAcceso, 280) }}>
          {cargaInicialCompleta && <View style={estilos.saldo}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Text style={estilos.saldoEtiqueta}>MI ESTADO DE CUENTA</Text><IconoAlumno nombre="wallet" color={colores.sobrePrimarioOscuro} /></View>
            <Text style={estilos.saldoValor}>{saldo === null ? '—' : pesos(saldo)}</Text>
            <Text style={estilos.saldoDetalle}>{saldo === null ? 'No se pudo consultar tu saldo. Abre Estado de cuenta para reintentar.' : saldo > 0 ? 'Saldo pendiente por cubrir' : saldo === 0 ? 'No tienes saldo pendiente en esta consulta.' : 'Consulta el detalle de tu saldo a favor en Estado de cuenta.'}</Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Consultar detalle de mi saldo" onPress={() => navegar('Pagos')} style={estilos.saldoBoton}><Text style={{ color: colores.sobrePrimarioOscuro, fontSize: 12, fontWeight: '600' }}>Ver estado de cuenta</Text><IconoAlumno nombre="arrow" color={colores.sobrePrimarioOscuro} tamano={18} /></TouchableOpacity>
          </View>}
          <PendientesBoletas />
        </View>
      </View>
      <View style={estilos.tituloSeccion}><Text accessibilityRole="header" style={estilos.subtitulo}>Agenda y avisos</Text></View>
      <CalendarioCiclo />
      {cargaInicialCompleta && avisos === null && <Text style={base.secundario}>Avisos no disponibles. Intenta actualizar.</Text>}
      {cargaInicialCompleta && avisos?.length === 0 && <Tarjeta><View style={estilos.vacioFila}><IconoAlumno nombre="bell" color={colores.gris} /><Text style={base.secundario}>Sin avisos por ahora.</Text></View></Tarjeta>}
      {cargaInicialCompleta && avisos?.slice(0, 5).map(aviso => <TouchableOpacity key={aviso.id} onPress={() => leerAviso(aviso)} accessibilityRole="button"
        accessibilityLabel={`Aviso: ${aviso.titulo}. ${aviso.leida ? 'Ya leído' : 'Marcar como leído'}`} accessibilityState={{ disabled: aviso.leida }} disabled={aviso.leida}>
        <View style={[base.tarjeta, !aviso.leida && { borderLeftWidth: 3, borderLeftColor: marca.colorAcento }]}>
          <Text style={base.tituloTarjeta}>{aviso.titulo}</Text><Text style={base.secundario}>{aviso.mensaje}</Text>
          <Text style={estilos.fecha}>{new Date(aviso.createdAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}</Text>
        </View>
      </TouchableOpacity>)}
      {cargaInicialCompleta && <Text style={[base.tituloTarjeta, { marginVertical: 16 }]}>Próximos eventos</Text>}
      {cargaInicialCompleta && eventos === null && <Text style={base.secundario}>Calendario no disponible. Intenta actualizar.</Text>}
      {cargaInicialCompleta && eventos?.length === 0 && <Text style={base.secundario}>Sin eventos en los próximos 30 días.</Text>}
      {cargaInicialCompleta && eventos?.slice(0, 5).map(ev => <Tarjeta key={ev.id}><Text style={base.tituloTarjeta}>{ev.titulo}</Text><Text style={base.secundario}>{ev.tipo} · {fechaHoraEscolar(ev.fechaInicio)}</Text></Tarjeta>)}
      <View style={{ marginTop: 24 }}><SeguimientoAlumno /></View>
      <View style={estilos.pie}><Text style={estilos.fecha}>{marca.nombreInstitucion} · Portal del alumno</Text></View>
    </ScrollView>
  );
}

const crearEstilos = (colores: ColoresAlumno) => StyleSheet.create({
  saludoFila: { flexDirection: 'row', alignItems: 'center', gap: 24, padding: 22, marginBottom: 32, flexWrap: 'wrap', backgroundColor: colores.superficie, borderRadius: 16, borderWidth: 1, borderColor: colores.linea, borderLeftWidth: 4, borderLeftColor: colores.dorado },
  avatar: { width: 92, height: 92, borderRadius: 46, backgroundColor: colores.suave, alignItems: 'center', justifyContent: 'center' },
  saludo: { fontSize: 36, lineHeight: 45, letterSpacing: -1, color: colores.tinta, fontWeight: '700' },
  perfilEnlace: { flexDirection: 'row', gap: 5, alignItems: 'center', minHeight: 38, alignSelf: 'flex-start' },
  enlace: { fontSize: 13, fontWeight: '600' },
  botonAula: { minHeight: 50, paddingHorizontal: 18, borderWidth: 1, borderRadius: 8, flexDirection: 'row', gap: 12, alignItems: 'center' },
  tituloSeccion: { marginBottom: 20, gap: 5 }, subtitulo: { fontSize: 23, fontWeight: '700', letterSpacing: -.4, color: colores.tinta },
  grilla: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 24, alignItems: 'stretch' },
  servicio: { flexDirection: 'row', minHeight: 186, backgroundColor: colores.superficie, borderWidth: 1, borderColor: colores.linea, borderRadius: 10, overflow: 'hidden', minWidth: 0 },
  ilustracion: { width: '29%', minWidth: 68, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  circuloDecorativo: { position: 'absolute', width: 130, height: 130, borderRadius: 65, borderWidth: 1, borderColor: 'rgba(50,75,85,.12)', top: -45, left: -50 },
  lineaDecorativa: { position: 'absolute', width: 80, height: 80, borderRadius: 40, borderWidth: 18, borderColor: 'rgba(255,255,255,.32)', bottom: -32, right: -40 },
  servicioContenido: { flex: 1, minWidth: 0, padding: 18, gap: 9 }, servicioTitulo: { fontSize: 18, lineHeight: 24, fontWeight: '700', color: colores.tinta },
  accionServicio: { marginTop: 'auto', paddingTop: 12, minHeight: 32, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'space-between' }, accionTexto: { fontSize: 13, fontWeight: '700', flexShrink: 1 },
  acceso: { minHeight: 74, backgroundColor: colores.superficie, borderWidth: 1, borderColor: colores.linea, borderRadius: 10, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconoAcceso: { width: 40, height: 40, backgroundColor: colores.suave, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, accesoTexto: { flex: 1, fontSize: 14, fontWeight: '600', color: colores.tinta },
  error: { borderWidth: 1, borderColor: colores.peligro, padding: 16, marginBottom: 24, borderRadius: 10, backgroundColor: colores.superficie },
  saldo: { backgroundColor: colores.pizarraOscuro, padding: 24, borderRadius: 12, marginBottom: 16 }, saldoEtiqueta: { color: colores.sobrePrimarioOscuro, fontSize: 10, fontWeight: '600', letterSpacing: 1.1 },
  saldoValor: { color: colores.sobrePrimarioOscuro, fontSize: 32, fontWeight: '600', marginTop: 18, fontVariant: ['tabular-nums'] }, saldoDetalle: { color: colores.sobrePrimarioOscuro, fontSize: 12, lineHeight: 20, marginTop: 5 },
  saldoBoton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colores.dorado, marginTop: 18, paddingTop: 12 },
  vacioFila: { flexDirection: 'row', alignItems: 'center', gap: 12 }, fecha: { color: colores.gris, fontSize: 11, marginTop: 8 }, pie: { marginTop: 36, borderTopWidth: 1, borderTopColor: colores.linea, paddingTop: 12, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
});
