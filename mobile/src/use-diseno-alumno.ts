import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useWindowDimensions } from "react-native";
import { calcularDisenoAlumno } from "./diseno-alumno";
import { useContext } from 'react';
import { AnchoPortalContext } from './portal-alumno';
export function useDisenoAlumno() {
  const { width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const anchoPortal = useContext(AnchoPortalContext);
  const diseno = calcularDisenoAlumno(
    Math.max(1, (anchoPortal ?? width) - insets.left - insets.right),
    fontScale,
  );
  return {
    ...diseno,
    pantallaScroll: {
      width: '100%' as const,
      maxWidth: 1200,
      alignSelf: 'center' as const,
      padding: 0,
      paddingHorizontal: 0,
      paddingTop: 0,
    },
    contenidoScroll: { paddingHorizontal: diseno.lateral, paddingTop: 32, paddingBottom: 32 },
    pantalla: {
      width: "100%" as const,
      maxWidth: 1200,
      alignSelf: "center" as const,
      paddingHorizontal: diseno.lateral,
    },
  };
}
