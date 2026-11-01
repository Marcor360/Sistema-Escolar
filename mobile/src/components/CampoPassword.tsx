import { forwardRef, useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import type { TextInputProps } from 'react-native';
import { Text } from './Texto';
import { colores } from '../theme';

interface Props extends Omit<TextInputProps, 'secureTextEntry'> {
  etiquetaControl?: string;
}

export const CampoPassword = forwardRef<TextInput, Props>(function CampoPassword(
  { etiquetaControl = 'contraseña', style, editable = true, ...props }, ref,
) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={styles.contenedor}>
      <TextInput
        {...props}
        ref={ref}
        style={[style, styles.input]}
        editable={editable}
        secureTextEntry={!visible}
      />
      <TouchableOpacity
        style={styles.ojo}
        disabled={!editable}
        accessibilityRole="button"
        accessibilityLabel={`${visible ? 'Ocultar' : 'Mostrar'} ${etiquetaControl}`}
        accessibilityState={{ disabled: !editable, selected: visible }}
        onPress={() => setVisible(v => !v)}
      >
        <Text style={styles.grafico}>👁</Text>
        {!visible && <View pointerEvents="none" style={styles.barra} />}
      </TouchableOpacity>
    </View>
  );
});

const styles = StyleSheet.create({
  contenedor: { position: 'relative', width: '100%' },
  input: { paddingRight: 56 },
  ojo: {
    position: 'absolute', right: 3, top: 2, minHeight: 44, minWidth: 44,
    alignItems: 'center', justifyContent: 'center', borderRadius: 10,
  },
  grafico: { color: colores.tinta, fontSize: 21 },
  barra: {
    position: 'absolute', width: 30, borderTopWidth: 2, borderColor: colores.tinta,
    transform: [{ rotate: '-45deg' }],
  },
});
