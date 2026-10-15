/** Validación exclusiva de artefactos distribuidos; no cambia el modo de desarrollo. */
export function validarUrlApiBuild(valor: string | undefined): string {
  if (!valor?.trim()) throw new Error('VITE_API_URL es obligatoria para generar un build distribuible');
  let url: URL;
  try { url = new URL(valor); } catch { throw new Error('VITE_API_URL debe ser una URL HTTPS absoluta'); }
  if (url.protocol !== 'https:' || !url.hostname ||
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname.toLowerCase()) ||
    url.username || url.password || url.search || url.hash || url.pathname !== '/api') {
    throw new Error('VITE_API_URL debe ser una dirección HTTPS válida, sin credenciales ni parámetros y terminar en /api');
  }
  return url.toString().replace(/\/$/, '');
}
