import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { api } from './api/client';

Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });
const INSTALACION = 'escolar_push_instalacion';
async function instalacion() {
  const previa = await SecureStore.getItemAsync(INSTALACION);
  if (previa) return previa;
  const nueva = Crypto.randomUUID(); await SecureStore.setItemAsync(INSTALACION, nueva); return nueva;
}
export async function activarPush(usuarioId: number, solicitarPermiso = true) {
  if (!solicitarPermiso && await SecureStore.getItemAsync(`push_optin_${usuarioId}`) !== 'true') return;
  if (!Device.isDevice) throw new Error('Las notificaciones push requieren un dispositivo físico y una build firmada.');
  const projectId = Constants.easConfig?.projectId || Constants.expoConfig?.extra?.eas?.projectId || process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  if (!projectId) throw new Error('Falta configurar el proyecto EAS de esta build.');
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('default', { name: 'Avisos escolares', importance: Notifications.AndroidImportance.DEFAULT });
  let permiso = await Notifications.getPermissionsAsync();
  if (permiso.status !== 'granted' && solicitarPermiso) permiso = await Notifications.requestPermissionsAsync();
  if (permiso.status !== 'granted') throw new Error('El permiso de notificaciones está desactivado. Puedes habilitarlo desde los ajustes del dispositivo.');
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  const { data } = await api.post<{ habilitado: boolean }>('/notificaciones/push/dispositivos', { instalacionId: await instalacion(), token });
  await SecureStore.setItemAsync(`push_optin_${usuarioId}`, 'true');
  return data.habilitado;
}
export async function desactivarPush(usuarioId: number) {
  const id = await SecureStore.getItemAsync(INSTALACION);
  if (id) await api.delete(`/notificaciones/push/dispositivos/${id}`);
  await SecureStore.deleteItemAsync(`push_optin_${usuarioId}`);
  await Notifications.dismissAllNotificationsAsync();
}
