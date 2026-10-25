import * as SecureStore from 'expo-secure-store';

const PREFERENCIA = 'escolar_biometria_usuario';
const GUARDIA = 'escolar_biometria_guardia';

/** SecureStore delega al sistema operativo; nunca se guardan huellas ni rostros. */
export function biometriaDisponible(): boolean {
  return SecureStore.canUseBiometricAuthentication();
}
export async function preferenciaBiometrica(): Promise<number | null> {
  const valor = await SecureStore.getItemAsync(PREFERENCIA);
  if (!valor || !/^[1-9]\d*$/.test(valor)) return null;
  return Number(valor);
}
export async function habilitarBiometria(usuarioId: number): Promise<void> {
  if (!biometriaDisponible()) throw new Error('Este dispositivo no tiene biometría disponible o configurada.');
  await SecureStore.setItemAsync(GUARDIA, String(usuarioId), {
    requireAuthentication: true,
    authenticationPrompt: 'Activa el acceso biométrico a tu cuenta escolar',
  });
  const verificado = await desbloquearBiometria(usuarioId);
  if (!verificado) throw new Error('No se autorizó la biometría.');
  await SecureStore.setItemAsync(PREFERENCIA, String(usuarioId));
}
export async function desbloquearBiometria(usuarioId: number): Promise<boolean> {
  try {
    const identidad = await SecureStore.getItemAsync(GUARDIA, {
      requireAuthentication: true,
      authenticationPrompt: 'Desbloquea tu cuenta escolar',
    });
    return identidad === String(usuarioId);
  } catch {
    return false;
  }
}
export async function borrarPreferenciaBiometrica(): Promise<void> {
  await SecureStore.deleteItemAsync(PREFERENCIA);
  await SecureStore.deleteItemAsync(GUARDIA);
}
