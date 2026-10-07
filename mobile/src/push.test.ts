import { beforeEach, expect, it, vi } from 'vitest';
const { notificaciones, secure, apiMock, constantes } = vi.hoisted(() => ({
  notificaciones: { setNotificationHandler: vi.fn(), setNotificationChannelAsync: vi.fn(), getPermissionsAsync: vi.fn(), requestPermissionsAsync: vi.fn(), getExpoPushTokenAsync: vi.fn(), dismissAllNotificationsAsync: vi.fn(), AndroidImportance: { DEFAULT: 3 } },
  secure: { getItemAsync: vi.fn(), setItemAsync: vi.fn(), deleteItemAsync: vi.fn() },
  apiMock: { post: vi.fn(), delete: vi.fn() }, constantes: { easConfig: { projectId: 'proyecto' } },
}));
vi.mock('expo-notifications', () => notificaciones); vi.mock('expo-device', () => ({ isDevice: true }));
vi.mock('expo-secure-store', () => secure); vi.mock('expo-crypto', () => ({ randomUUID: () => 'instalacion' }));
vi.mock('expo-constants', () => ({ default: constantes })); vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('./api/client', () => ({ api: apiMock }));
import { activarPush, desactivarPush } from './push';
beforeEach(() => { vi.clearAllMocks(); secure.getItemAsync.mockResolvedValue(null); notificaciones.getPermissionsAsync.mockResolvedValue({ status: 'granted' }); notificaciones.getExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[abc]' }); apiMock.post.mockResolvedValue({ data: { habilitado: true } }); });
it('no solicita permisos automáticamente sin elección previa del alumno', async () => { await activarPush(1, false); expect(notificaciones.getPermissionsAsync).not.toHaveBeenCalled(); expect(apiMock.post).not.toHaveBeenCalled(); });
it('respeta el rechazo del permiso sin registrar token', async () => { notificaciones.getPermissionsAsync.mockResolvedValue({ status: 'denied' }); notificaciones.requestPermissionsAsync.mockResolvedValue({ status: 'denied' }); await expect(activarPush(1)).rejects.toThrow('permiso'); expect(apiMock.post).not.toHaveBeenCalled(); });
it('registra instalación sin poner credenciales del proveedor en el teléfono', async () => { await expect(activarPush(1)).resolves.toBe(true); expect(apiMock.post).toHaveBeenCalledWith('/notificaciones/push/dispositivos', { instalacionId: 'instalacion', token: 'ExponentPushToken[abc]' }); expect(secure.setItemAsync).toHaveBeenCalledWith('push_optin_1', 'true'); });
it('retira solo la instalación propia y elimina notificaciones del sistema', async () => { secure.getItemAsync.mockResolvedValue('instalacion'); await desactivarPush(1); expect(apiMock.delete).toHaveBeenCalledWith('/notificaciones/push/dispositivos/instalacion'); expect(secure.deleteItemAsync).toHaveBeenCalledWith('push_optin_1'); expect(notificaciones.dismissAllNotificationsAsync).toHaveBeenCalled(); });
