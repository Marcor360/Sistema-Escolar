import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api, mensajeDeError } from '../api/client';
import { useSesion } from '../sesion';
import { colores } from '../theme';
import { base, Tarjeta } from './comunes';

interface Perfil {
  matricula: string;
  estatus: string;
  curp: string | null;
  tutorNombre: string | null;
  usuario: { nombreCompleto?: string; nombre: string; apellidoPaterno: string; email: string };
}

export default function PerfilScreen() {
  const { sesion, cerrar } = useSesion();
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');

  const cambiarPassword = async () => {
    if (nueva.length < 8) { Alert.alert('Revisa la contraseña', 'La nueva contraseña debe tener al menos 8 caracteres.'); return; }
    try {
      await api.post('/auth/cambiar-password', { actual, nueva });
      setActual(''); setNueva('');
      Alert.alert('Listo', 'Tu contraseña fue actualizada.');
    } catch (err) {
      Alert.alert('No se pudo actualizar', mensajeDeError(err));
    }
  };

  useFocusEffect(
    useCallback(() => {
      api.get<Perfil>('/alumnos/me/perfil').then((r) => setPerfil(r.data)).catch(() => setPerfil(null));
    }, []),
  );

  return (
    <ScrollView style={base.pantalla}>
      <Tarjeta>
        <Text style={base.tituloTarjeta}>{sesion?.nombre}</Text>
        <Text style={base.secundario}>{sesion?.email}</Text>
        {perfil && (
          <>
            <Text style={[base.secundario, { marginTop: 8 }]}>Matrícula: {perfil.matricula}</Text>
            {perfil.curp && <Text style={base.secundario}>CURP: {perfil.curp}</Text>}
            {perfil.tutorNombre && <Text style={base.secundario}>Tutor: {perfil.tutorNombre}</Text>}
            <Text style={base.secundario}>Estatus: {perfil.estatus}</Text>
          </>
        )}
      </Tarjeta>
      <Tarjeta>
        <Text style={base.tituloTarjeta}>Cambiar contraseña</Text>
        <Text style={estilos.etiqueta}>Contraseña actual</Text>
        <TextInput style={estilos.input} secureTextEntry value={actual} onChangeText={setActual} />
        <Text style={estilos.etiqueta}>Nueva contraseña (mínimo 8)</Text>
        <TextInput style={estilos.input} secureTextEntry value={nueva} onChangeText={setNueva} />
        <TouchableOpacity style={estilos.botonPrimario} onPress={cambiarPassword}>
          <Text style={estilos.botonPrimarioTexto}>Actualizar contraseña</Text>
        </TouchableOpacity>
      </Tarjeta>

      <TouchableOpacity style={estilos.boton} onPress={cerrar}>
        <Text style={estilos.botonTexto}>Cerrar sesión</Text>
      </TouchableOpacity>
      <Text style={{ height: 24 }} />
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  etiqueta: {
    fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase',
    color: colores.gris, marginTop: 10, marginBottom: 4,
  },
  input: {
    borderWidth: 1, borderColor: '#B9C0BA', backgroundColor: '#fff',
    paddingHorizontal: 10, paddingVertical: 8, color: colores.tinta,
  },
  botonPrimario: {
    marginTop: 12, alignSelf: 'flex-start', backgroundColor: colores.pizarra,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  botonPrimarioTexto: { color: '#fff', fontSize: 13 },
  boton: {
    marginTop: 8, alignSelf: 'flex-start', borderWidth: 1, borderColor: colores.peligro,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  botonTexto: { color: colores.peligro, fontSize: 13 },
});
