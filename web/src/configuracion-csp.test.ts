import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('permite previsualizar imágenes locales blob: sin ampliar otras directivas de CSP', () => {
  const configuracion = readFileSync(new URL('../public/web.config', import.meta.url), 'utf8');
  const politica = configuracion.match(/<add name="Content-Security-Policy" value="([^"]+)"\\s*\\/>/)?.[1];
  expect(politica).toBeDefined();

  const directivas = (politica ?? '').split(';')
    .map((directiva) => directiva.trim().split(/\\s+/))
    .filter(([nombre]) => Boolean(nombre));
  expect(directivas.find(([nombre]) => nombre === 'img-src')).toContain('blob:');
  for (const [nombre, ...fuentes] of directivas) {
    if (nombre !== 'img-src') expect(fuentes).not.toContain('blob:');
  }
});
