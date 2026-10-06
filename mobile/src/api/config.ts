/** La configuración Expo se incorpora al bundle; nunca usar localhost en preview/producción. */
export function resolverApiUrl(appEnv: string, apiUrl?: string): string {
  if (appEnv === 'development') return apiUrl || 'http://localhost:3000/api';
  if (!apiUrl) throw new Error(`Falta la URL de la API para ${appEnv}`);
  let url: URL;
  try {
    url = new URL(apiUrl);
  } catch {
    throw new Error(`La URL de la API para ${appEnv} no es válida`);
  }
  if (url.protocol !== 'https:' || /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(url.hostname)) {
    throw new Error(`La URL de la API para ${appEnv} debe usar HTTPS público`);
  }
  return apiUrl;
}
