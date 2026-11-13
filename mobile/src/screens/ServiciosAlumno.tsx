import type { VistaSeguimientoAlumno } from '../recorrido-alumno';
import { ScrollView } from 'react-native';
import { CalendarioCiclo } from '../components/CalendarioCiclo';
import { SeguimientoAlumno } from '../components/SeguimientoAlumno';
import { useDisenoAlumno } from '../use-diseno-alumno';
import { base, GuiaPantalla } from './comunes';

export function CalendarioAlumnoScreen() {
  const diseno = useDisenoAlumno();
  return <ScrollView style={[base.pantalla, diseno.pantalla]} contentContainerStyle={base.contenidoLista}>
    <GuiaPantalla titulo="Calendario escolar" detalle="Organiza tu próximo paso. Consulta las fechas y los eventos de tu ciclo escolar." />
    <CalendarioCiclo abiertoInicial />
  </ScrollView>;
}

export function TramitesAlumnoScreen({ route }: { route?: { params?: { vista?: VistaSeguimientoAlumno } } }) {
  const diseno = useDisenoAlumno();
  return <ScrollView style={[base.pantalla, diseno.pantalla]} contentContainerStyle={base.contenidoLista} keyboardShouldPersistTaps="handled">
    <GuiaPantalla titulo="Ventanilla de trámites" detalle="Solicita apoyo, revisa tus asistencias y da seguimiento a cada solicitud en un solo lugar." />
    <SeguimientoAlumno key={route?.params?.vista ?? "tramites"} abiertoInicial vistaInicial={route?.params?.vista ?? "tramites"} />
  </ScrollView>;
}
