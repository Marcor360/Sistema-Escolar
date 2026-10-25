import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => {
  const store = new Map<string,string>();
  return { store, get: vi.fn(), set: vi.fn(), del: vi.fn(), available: vi.fn() };
});
vi.mock('expo-secure-store', () => ({
  getItemAsync: mock.get, setItemAsync: mock.set, deleteItemAsync: mock.del, canUseBiometricAuthentication: mock.available,
}));
import { preferenciaBiometrica, habilitarBiometria, desbloquearBiometria, borrarPreferenciaBiometrica } from './biometria';
beforeEach(() => {
  mock.store.clear(); vi.clearAllMocks(); mock.available.mockReturnValue(true);
  mock.get.mockImplementation(async (key:string) => mock.store.get(key)??null);
  mock.set.mockImplementation(async (key:string,value:string) => {mock.store.set(key,value);});
  mock.del.mockImplementation(async (key:string) => {mock.store.delete(key);});
});
describe('Protección de sesión por biometría del dispositivo',()=>{
  it('requiere autenticación del SO antes de activar y desbloquear',async()=>{
    await habilitarBiometria(7);
    expect(mock.set).toHaveBeenCalledWith('escolar_biometria_guardia','7',expect.objectContaining({requireAuthentication:true}));
    expect(mock.get).toHaveBeenCalledWith('escolar_biometria_guardia',expect.objectContaining({requireAuthentication:true}));
    expect(await preferenciaBiometrica()).toBe(7);
    expect(await desbloquearBiometria(8)).toBe(false);
    await borrarPreferenciaBiometrica();
    expect(await preferenciaBiometrica()).toBeNull();
  });
  it('no habilita acceso si falta sensor o el sistema rechaza la autenticación',async()=>{
    mock.available.mockReturnValue(false);
    await expect(habilitarBiometria(7)).rejects.toThrow('no tiene biometría');
    mock.available.mockReturnValue(true);
    mock.get.mockRejectedValueOnce(Error('Usuario canceló'));
    await expect(habilitarBiometria(7)).rejects.toThrow('No se autorizó');
    expect(await preferenciaBiometrica()).toBeNull();
  });
});
