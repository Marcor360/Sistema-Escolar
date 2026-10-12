import { createContext, useContext } from 'react';
import { Text as TextoNativo } from 'react-native';
import type { TextProps } from 'react-native';

export const FuenteContext = createContext(false);

/** Onest se carga localmente al iniciar Expo; se conserva la tipografía del sistema si falla. */
export function Text({ style, ...props }: TextProps) {
  const fuenteLista = useContext(FuenteContext);
  return <TextoNativo {...props} style={[fuenteLista ? { fontFamily: 'Onest' } : undefined, style]} />;
}
