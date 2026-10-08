/** Encabezado HTTP ASCII con nombre UTF-8 (RFC 5987), sin controles ni rutas. */
export function contentDisposition(nombre: string, modo: 'inline' | 'attachment'): string {
  const limpio = Array.from(Buffer.from(nombre, 'utf8').toString('utf8')).filter((c) => c.charCodeAt(0) >= 32 && c.charCodeAt(0) !== 127).join('').replace(/[/\\]/g, '_') || 'archivo';
  const ascii = limpio.replace(/[^\x20-\x7e]|["\\]/g, '_');
  const utf8 = encodeURIComponent(limpio).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${modo}; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}
