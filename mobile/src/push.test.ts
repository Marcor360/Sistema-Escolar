import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  post: vi.fn(), del: vi.fn(), get: vi.fn(), set: vi.fn(), deleteSecure: vi.fn(),
  getToken: vi.fn(), permissions: vi.fn(), channel: vi.fn(), dismiss: vi.fn(),
}));
vi.mock('./api/client', () => ({ api: { post: mocks.post, delete: mocks.del } }));
vi.mock('expo-notifications', () => ({
  setNotificationHandler: vi.fn(),
  setNotificationChannelAsync: mocks.channel,
  getPermissionsAsync: mocks.permissions,
  requestPermissionsAsync: vi.fn(),
  getExpoPushTokenAsync: mocks.getToken,
  dismissAllNotificationsAsync: mocks.dismiss,
  AndroidImportance: { DEFAULT: 3 },
}));
vi.mock('expo-device', () => ({ isDevice: true }));
vi.mock('expo-secure-store', () => ({
  getItemAsync: mocks.get, setItemAsync: mocks.set, deleteItemAsync: mocks.deleteSecure,
}));
vi.mock('expo-crypto', () => ({ randomUUID: () => 'e9a3af62-e408-4e1f-9dec-bf3998f8200a' }));
vi.mock('expo-constants', () => ({ default: { easConfig: { projectId: 'expo-qa' } } }));
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
import { activarPush, limpiarPreferenciaPushLocal } from './push';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.get.mockResolvedValue(null);
  mocks.set.mockResolvedValue(undefined);
  mocks.deleteSecure.mockResolvedValue(undefined);
  mocks.channel.mockResolvedValue(undefined);
  mocks.permissions.mockResolvedValue({ status: 'granted' });
  mocks.getToken.mockResolvedValue({ data: 'ExponentPushToken[abc]' });
  mocks.post.mockResolvedValue({ data: { habilitado: true } });
});
it('evita guardar una suscripción tardía después de cerrar sesión', async () => {
  let resolver!: (valor: { data: { habilitado: boolean } }) => void;
  mocks.post.mockImplementationOnce(() => new Promise((r) => { resolver = r; }));
  const activacion = activarPush(7);
  await vi.waitFor(() => expect(mocks.post).toHaveBeenCalledOnce());
  await limpiarPreferenciaPushLocal(7);
  resolver({ data: { habilitado: true } });
  expect(await activacion).toBe(false);
  expect(mocks.set).not.toHaveBeenCalledWith('push_optin_7', 'true');
  expect(mocks.deleteSecure).toHaveBeenCalledWith('push_optin_7');
});
it('guarda la preferencia únicamente al confirmar API y permiso del dispositivo', async () => {
  expect(await activarPush(8)).toBe(true);
  expect(mocks.set).toHaveBeenCalledWith('push_optin_8', 'true');
});
