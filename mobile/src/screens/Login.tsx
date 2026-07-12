import { useState } from 'react';
import {
  Image, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSesion } from '../sesion';
import { archivosBase, mensajeDeError } from '../api/client';
import { colores } from '../theme';
import { useMarca } from '../marca';

export default function LoginScreen() {
  const { iniciar } = useSesion();
  const { marca } = useMarca();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const entrar = async () => {
    setError('');
    setEnviando(true);
    try {
      await iniciar(email.trim(), password);
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <KeyboardAvoidingView style={[estilos.fondo, { backgroundColor: marca.colorPrimario }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[estilos.caja, { borderTopColor: marca.colorAcento }]}>
        {marca.logoUrl
          ? <Image source={{ uri: archivosBase + marca.logoUrl }} style={estilos.logo} resizeMode="contain" />
          : <View style={[estilos.monograma, { borderColor: marca.colorPrimario }]}><Text style={[estilos.monogramaTexto, { color: marca.colorPrimario }]}>{marca.nombreCorto}</Text></View>}
        <Text style={estilos.titulo}>{marca.nombreInstitucion}</Text>
        <Text style={estilos.etiqueta}>Correo institucional</Text>
        <TextInput
          style={estilos.input} autoCapitalize="none" keyboardType="email-address"
          value={email} onChangeText={setEmail}
        />
        <Text style={estilos.etiqueta}>Contraseña</Text>
        <TextInput style={estilos.input} secureTextEntry value={password} onChangeText={setPassword} />
        {error !== '' && <Text style={estilos.error}>{error}</Text>}
        <TouchableOpacity style={[estilos.boton, { backgroundColor: marca.colorPrimario }]} onPress={entrar} disabled={enviando}>
          <Text style={estilos.botonTexto}>{enviando ? 'Verificando…' : 'Entrar'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: colores.pizarra, justifyContent: 'center', padding: 24 },
  caja: { backgroundColor: colores.papel, padding: 28, borderTopWidth: 4, borderTopColor: colores.dorado },
  monograma: {
    width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: colores.pizarra,
    alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  monogramaTexto: { fontSize: 18, color: colores.pizarra, fontWeight: '600' },
  logo: { width: 160, height: 72, alignSelf: 'center', marginBottom: 10 },
  titulo: { fontSize: 20, textAlign: 'center', marginBottom: 20, color: colores.tinta },
  etiqueta: { fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: colores.gris, marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: '#B9C0BA', backgroundColor: '#fff',
    paddingHorizontal: 10, paddingVertical: 9, marginBottom: 14, color: colores.tinta,
  },
  error: { color: colores.peligro, marginBottom: 10 },
  boton: { backgroundColor: colores.pizarra, paddingVertical: 12, alignItems: 'center' },
  botonTexto: { color: '#fff', fontSize: 15 },
});
