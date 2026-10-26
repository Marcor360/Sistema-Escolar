import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useWindowDimensions } from "react-native";
import { calcularDisenoAlumno } from "./diseno-alumno";
export function useDisenoAlumno() {
  const { width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const diseno = calcularDisenoAlumno(
    Math.max(1, width - insets.left - insets.right),
    fontScale,
  );
  return {
    ...diseno,
    pantalla: {
      width: "100%" as const,
      maxWidth: 900,
      alignSelf: "center" as const,
      paddingHorizontal: diseno.lateral,
    },
  };
}
