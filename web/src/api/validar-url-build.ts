/** Validación exclusiva de artefactos distribuidos; no cambia el modo de desarrollo. */
export function validarUrlApiBuild(valor: string | undefined): string {
  if (!valor?.trim()) throw new Error('VITE_API_URL es obligatoria para generar un build distribuible');
  let url: URL;
  try { url = new URL(valor); } catch { throw new Error('VITE_API_URL debe ser una URL HTTPS absoluta'); }
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (valor !== valor.trim() || /[\\\s?#]/.test(valor) || url.protocol !== 'https:' || !url.hostname ||
    (host === 'localhost' || host.endsWith('.localhost') || /^127\./.test(host) || host === '[::1]' || host.startsWith('[::ffff:7f')) ||
    url.username || url.password || url.search || url.hash || url.pathname !== '/api') {
    throw new Error('VITE_API_URL debe ser una dirección HTTPS válida, sin credenciales ni parámetros y terminar en /api');
  }
  return url.toString().replace(/\/$/, '');
}
