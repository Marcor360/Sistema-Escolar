import { resolve } from 'path';

/** Resuelve UPLOADS_DIR tanto si es absoluta como relativa al directorio del backend. */
export function uploadsPath(value = process.env.UPLOADS_DIR || 'uploads'): string {
  return resolve(process.cwd(), value);
}
