import { describe, expect, it } from 'vitest';
import { claveRecorrido, construirRecorrido } from './recorrido-por-rol';

const rutas = [
  { destino: '/', roles: ['ADMINISTRATIVO', 'FINANZAS', 'MAESTRO'] },
  { destino: '/maestro', roles: ['MAESTRO'] },
  { destino: '/finanzas', roles: ['FINANZAS'] },
  { destino: '/configuracion', roles: ['SUPERADMIN'] },
];
const grupos = [
  { titulo: 'Inicio y seguimiento', rutas: ['/'] },
  { titulo: 'Docencia', rutas: ['/maestro'] },
  { titulo: 'Finanzas e informes', rutas: ['/finanzas'] },
  { titulo: 'Administración', rutas: ['/configuracion'] },
];
describe('recorrido según permisos de navegación', () => {
  it('no anuncia finanzas ni configuración a un docente', () => {
    expect(construirRecorrido(grupos, rutas, ['MAESTRO']).map(p => p.destino)).toEqual(['/', '/maestro']);
  });
  it('incluye lo visible al superadministrador y suma varios roles', () => {
    expect(construirRecorrido(grupos, rutas, ['SUPERADMIN'])).toHaveLength(4);
    expect(construirRecorrido(grupos, rutas, ['FINANZAS', 'MAESTRO']).map(p => p.destino)).toEqual(['/', '/maestro', '/finanzas']);
  });
  it('distingue cuentas y normaliza la lista de roles', () => {
    expect(claveRecorrido(1, ['MAESTRO', 'FINANZAS'])).toBe(claveRecorrido(1, ['FINANZAS', 'MAESTRO']));
    expect(claveRecorrido(2, ['MAESTRO'])).not.toBe(claveRecorrido(1, ['MAESTRO']));
  });
});
