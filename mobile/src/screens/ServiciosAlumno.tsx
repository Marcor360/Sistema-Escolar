import type { VistaSeguimientoAlumno } from '../recorrido-alumno';
import { ScrollView } from 'react-native';
import { CalendarioCiclo } from '../components/CalendarioCiclo';
import { SeguimientoAlumno } from '../components/SeguimientoAlumno';
import { useDisenoAlumno } from '../use-diseno-alumno';
import { useBase, BannerAlumno } from './comunes';

export function CalendarioAlumnoScreen() {
  const base = useBase();
  const diseno = useDisenoAlumno();
  return <ScrollView style={[base.pantalla, diseno.pantalla]} contentContainerStyle={base.contenidoLista}>
    <BannerAlumno titulo="Calendario escolar" icono="calendar" detalle="Consulta las fechas y los eventos de tu ciclo escolar." />
    <CalendarioCiclo abiertoInicial />
  </ScrollView>;
}

export function TramitesAlumnoScreen({ route }: { route?: { params?: { vista?: VistaSeguimientoAlumno } } }) {
  const base = useBase();
  const diseno = useDisenoAlumno();
  return <ScrollView style={[base.pantalla, diseno.pantalla]} contentContainerStyle={base.contenidoLista} keyboardShouldPersistTaps="handled">
    <BannerAlumno titulo="Ventanilla de trámites" icono="document" detalle="Solicita documentos, revisa tus asistencias y da seguimiento a tus solicitudes." />
    <SeguimientoAlumno key={route?.params?.vista ?? "tramites"} abiertoInicial vistaInicial={route?.params?.vista ?? "tramites"} />
  </ScrollView>;
}
